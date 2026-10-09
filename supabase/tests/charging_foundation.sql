-- Run after the migration in a disposable test database, as its owner.
-- ON_ERROR_STOP is required so failed assertions cannot be reported as passes.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then
    raise exception 'Assertion failed: %', message;
  end if;
end;
$$;

create function pg_temp.expect_error(statement text, expected_state text)
returns void language plpgsql as $$
declare actual_state text;
begin
  begin
    execute statement;
  exception when others then
    get stacked diagnostics actual_state = returned_sqlstate;
  end;
  if actual_state is distinct from expected_state then
    raise exception 'Expected SQLSTATE %, received %: %', expected_state, actual_state, statement;
  end if;
end;
$$;

-- Fixture-derived location/technical fields; test source, IDs and observations
-- are synthetic. These are not a new observation of the live source.
insert into public.charging_locations (
  id, source, country_code, party_id, ocpi_location_id, operator_name,
  name, address, city, latitude, longitude, source_last_updated_text,
  first_observed_at, last_observed_at
) values (
  '00000000-0000-4000-8000-000000000001', 'task004a-test', 'LT', 'IBG', '258',
  'In Balance grid, UAB', 'L3 | Inbalance grid', 'Laisvės pr. 3', 'Vilnius',
  54.6745570, 25.2243550, '2026-10-09T17:52:46',
  '2026-10-09T20:00:00Z', '2026-10-09T20:00:00Z'
);

insert into public.charging_locations (
  id, source, country_code, party_id, ocpi_location_id, first_observed_at, last_observed_at
) values (
  '00000000-0000-4000-8000-000000000002', 'task004a-test', 'LT', 'IBG',
  'test-second-location', '2026-10-09T20:00:00Z', '2026-10-09T20:00:00Z'
);

select pg_temp.assert_true((select position is null from public.charging_locations
  where ocpi_location_id = 'test-second-location'), 'missing coordinates remain NULL');
select pg_temp.assert_true((select source_last_updated_at is null from public.charging_locations
  where source = 'task004a-test' and ocpi_location_id = '258'), 'uncertain source time remains NULL');
select pg_temp.assert_true((select extensions.st_srid(position::extensions.geometry) = 4326
  and abs(extensions.st_x(position::extensions.geometry) - 25.2243550) < 0.0000001
  and abs(extensions.st_y(position::extensions.geometry) - 54.6745570) < 0.0000001
  from public.charging_locations where source = 'task004a-test' and ocpi_location_id = '258'),
  'generated WGS84 point uses longitude then latitude');
select pg_temp.assert_true((select count(*) = 1 from public.charging_locations
  where source = 'task004a-test' and extensions.st_dwithin(position,
    extensions.st_setsrid(extensions.st_makepoint(25.2243550, 54.6745570),4326)::extensions.geography,100)),
  'nearby geography query excludes missing coordinates');
select pg_temp.assert_true((select exists (
  select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
  join pg_am a on a.oid = c.relam
  where c.oid = 'public.charging_locations_position_gist'::regclass
    and a.amname = 'gist' and i.indisvalid)), 'valid GiST geography index');

select pg_temp.expect_error($sql$
  insert into public.charging_locations (source,country_code,party_id,ocpi_location_id,first_observed_at,last_observed_at)
  values ('task004a-test','LT','IBG','258',now(),now())
$sql$, '23505');
select pg_temp.expect_error($sql$
  update public.charging_locations set latitude = 91 where ocpi_location_id = 'test-second-location'
$sql$, '23514');
select pg_temp.expect_error($sql$
  update public.charging_locations set longitude = 25 where ocpi_location_id = 'test-second-location'
$sql$, '23514');

insert into public.charging_evses (
  id, location_id, source, country_code, party_id, uid, public_evse_id,
  current_status, source_status, source_last_updated_text, first_observed_at, last_observed_at
) values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001',
    'task004a-test','LT','IBG','535','IBG-P-A9MY-A','AVAILABLE','AVAILABLE',
    '2026-10-09T17:21:50','2026-10-09T20:00:00Z','2026-10-09T20:00:00Z'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001',
    'task004a-test','LT','IBG','test-second-uid','IBG-P-A9MY-A','UNKNOWN','UNRECOGNIZED_TEST_STATUS',
    null,'2026-10-09T20:00:00Z','2026-10-09T20:00:00Z');

select pg_temp.assert_true((select count(*) = 2 from public.charging_evses
  where source = 'task004a-test' and public_evse_id = 'IBG-P-A9MY-A'),
  'same public EVSE ID is allowed for different technical UIDs');
select pg_temp.assert_true((select current_status = 'UNKNOWN' and source_status = 'UNRECOGNIZED_TEST_STATUS'
  from public.charging_evses where uid = 'test-second-uid'), 'unknown source value is preserved');

select pg_temp.expect_error($sql$
  insert into public.charging_evses (location_id,source,country_code,party_id,uid,first_observed_at,last_observed_at)
  values ('00000000-0000-4000-8000-000000000002','task004a-test','LT','IBG','535',now(),now())
$sql$, '23505');
select pg_temp.expect_error($sql$
  insert into public.charging_evses (location_id,source,country_code,party_id,uid,first_observed_at,last_observed_at)
  values ('00000000-0000-4000-8000-000000000001','wrong-source','LT','IBG','test-wrong-scope',now(),now())
$sql$, '23503');

-- ON CONFLICT preserves internal EVSE identity even when location changes.
insert into public.charging_evses (location_id,source,country_code,party_id,uid,first_observed_at,last_observed_at)
values ('00000000-0000-4000-8000-000000000002','task004a-test','LT','IBG','535',now(),now())
on conflict (source,country_code,party_id,uid) do update set location_id = excluded.location_id;
select pg_temp.assert_true((select id = '00000000-0000-4000-8000-000000000011'
  and location_id = '00000000-0000-4000-8000-000000000002'
  from public.charging_evses where source = 'task004a-test' and uid = '535'),
  'canonical upsert moves parent without creating a second EVSE');

insert into public.charging_connectors (evse_id,connector_id,standard,format,power_type,rated_power_w,
  voltage,amperage,tariff_ids,source_last_updated_text) values
  ('00000000-0000-4000-8000-000000000011','650306','IEC_62196_T2','SOCKET','AC_1_PHASE',22000,
    400,32,array['d37ff71c-0a3d-11f0-9a21-06a2d3719779'],'2024-09-02T15:49:50'),
  ('00000000-0000-4000-8000-000000000012','650306',null,null,null,null,null,null,null,null);
select pg_temp.assert_true((select count(*) = 2 from public.charging_connectors
  where connector_id = '650306'), 'connector identity is scoped to its EVSE');
select pg_temp.expect_error($sql$
  insert into public.charging_connectors (evse_id,connector_id)
  values ('00000000-0000-4000-8000-000000000011','650306')
$sql$, '23505');
select pg_temp.expect_error($sql$
  insert into public.charging_connectors (evse_id,connector_id)
  values ('00000000-0000-4000-8000-000000000099','orphan')
$sql$, '23503');
select pg_temp.expect_error($sql$
  update public.charging_connectors set rated_power_w = -1 where connector_id = '650306'
$sql$, '23514');

insert into public.source_poll_runs (id,source,started_at,completed_at,outcome,completeness,
  records_retrieved,pages_retrieved,advertised_total_count,pagination_metadata) values
  ('00000000-0000-4000-8000-000000000021','task004a-test','2026-10-09T20:00:30Z','2026-10-09T20:01:00Z',
    'SUCCESS','PARTIAL',1,1,3273,'{"offsets":[0],"returned_counts":[1]}'),
  ('00000000-0000-4000-8000-000000000022','other-test-source','2026-10-09T20:00:30Z','2026-10-09T20:01:00Z',
    'SUCCESS','COMPLETE',0,1,0,'{}');
insert into public.source_poll_runs (source,started_at,completed_at,outcome,completeness,error_information)
values ('task004a-test',now(),now(),'FAILURE','PARTIAL','Synthetic timeout');
select pg_temp.expect_error($sql$
  insert into public.source_poll_runs (source,started_at,completed_at,outcome,completeness,error_information)
  values ('task004a-test',now(),now(),'FAILURE','COMPLETE','Synthetic failure')
$sql$, '23514');

insert into public.evse_status_transitions (
  evse_id,source,poll_run_id,previous_status,new_status,previous_source_status,new_source_status,
  previous_observed_at,new_observed_at,source_last_updated_text
) values (
  '00000000-0000-4000-8000-000000000011','task004a-test','00000000-0000-4000-8000-000000000021',
  'AVAILABLE','CHARGING','AVAILABLE','CHARGING',
  '2026-10-09T20:00:00Z','2026-10-09T20:00:45Z','2026-10-09T22:59:00'
);
select pg_temp.assert_true((select new_observed_at - previous_observed_at = interval '45 seconds'
  and source_last_updated_at is null from public.evse_status_transitions
  where evse_id = '00000000-0000-4000-8000-000000000011'), 'transition interval and raw source timestamp retained');
select pg_temp.expect_error($sql$
  insert into public.evse_status_transitions (evse_id,source,poll_run_id,previous_status,new_status,
    previous_observed_at,new_observed_at)
  values ('00000000-0000-4000-8000-000000000011','task004a-test','00000000-0000-4000-8000-000000000021',
    'AVAILABLE','CHARGING','2026-10-09T20:00:00Z','2026-10-09T20:00:45Z')
$sql$, '23505');
select pg_temp.expect_error($sql$
  insert into public.evse_status_transitions (evse_id,source,poll_run_id,previous_status,new_status,
    previous_observed_at,new_observed_at)
  values ('00000000-0000-4000-8000-000000000012','task004a-test','00000000-0000-4000-8000-000000000022',
    'UNKNOWN','INOPERATIVE','2026-10-09T20:00:00Z','2026-10-09T20:00:45Z')
$sql$, '23503');
select pg_temp.expect_error($sql$
  insert into public.evse_status_transitions (evse_id,source,poll_run_id,previous_status,new_status,
    previous_observed_at,new_observed_at)
  values ('00000000-0000-4000-8000-000000000012','task004a-test','00000000-0000-4000-8000-000000000021',
    'UNKNOWN','INOPERATIVE','2026-10-09T20:00:45Z','2026-10-09T20:00:00Z')
$sql$, '23514');

select pg_temp.expect_error($sql$
  insert into public.evse_status_transitions (evse_id,source,poll_run_id,previous_status,new_status,
    previous_observed_at,new_observed_at)
  values ('00000000-0000-4000-8000-000000000012','task004a-test','00000000-0000-4000-8000-000000000021',
    'UNKNOWN','UNKNOWN','2026-10-09T20:00:00Z','2026-10-09T20:00:45Z')
$sql$, '23514');
insert into public.evse_status_transitions (evse_id,source,poll_run_id,previous_status,new_status,
  previous_source_status,new_source_status,previous_observed_at,new_observed_at)
values ('00000000-0000-4000-8000-000000000012','task004a-test','00000000-0000-4000-8000-000000000021',
  'UNKNOWN','UNKNOWN','UNRECOGNIZED_TEST_STATUS','ANOTHER_TEST_STATUS',
  '2026-10-09T20:00:00Z','2026-10-09T20:00:45Z');

select pg_temp.assert_true((select count(*) = 5 and bool_and(relrowsecurity)
  from pg_class where oid in ('public.charging_locations'::regclass,'public.charging_evses'::regclass,
    'public.charging_connectors'::regclass,'public.source_poll_runs'::regclass,
    'public.evse_status_transitions'::regclass)), 'all five tables have RLS enabled');

do $$
declare client_role text; table_name text;
begin
  foreach table_name in array array['charging_locations','charging_evses','charging_connectors',
    'source_poll_runs','evse_status_transitions'] loop
    perform pg_temp.assert_true(not has_table_privilege('public', 'public.' || table_name, 'SELECT')
      and not has_table_privilege('public', 'public.' || table_name, 'INSERT')
      and not has_table_privilege('public', 'public.' || table_name, 'UPDATE')
      and not has_table_privilege('public', 'public.' || table_name, 'DELETE'),
      'public has no direct access to ' || table_name);
  end loop;
  foreach client_role in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = client_role) then
      foreach table_name in array array['charging_locations','charging_evses','charging_connectors',
        'source_poll_runs','evse_status_transitions'] loop
        perform pg_temp.assert_true(not has_table_privilege(client_role, 'public.' || table_name, 'SELECT')
          and not has_table_privilege(client_role, 'public.' || table_name, 'INSERT')
          and not has_table_privilege(client_role, 'public.' || table_name, 'UPDATE')
          and not has_table_privilege(client_role, 'public.' || table_name, 'DELETE'),
          client_role || ' has no direct access to ' || table_name);
      end loop;
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    perform pg_temp.assert_true(
      has_table_privilege('service_role','public.evse_status_transitions','INSERT')
      and not has_table_privilege('service_role','public.evse_status_transitions','UPDATE')
      and not has_table_privilege('service_role','public.evse_status_transitions','DELETE'),
      'service_role can append transitions without update/delete privileges');
  end if;
end;
$$;

-- Runs can be repeated: all sample rows and temporary helper functions roll back.
-- Exercise real nonprivileged roles, then isolate default-deny RLS from ACLs.
-- All temporary grants below are reverted by the final ROLLBACK.
do $$
declare client_role text; table_name text; denied boolean; visible_rows bigint;
begin
  foreach client_role in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = client_role) then
      execute format('set local role %I', client_role);
      foreach table_name in array array['charging_locations','charging_evses','charging_connectors',
        'source_poll_runs','evse_status_transitions'] loop
        denied := false;
        begin
          execute format('select count(*) from public.%I', table_name) into visible_rows;
        exception when insufficient_privilege then
          denied := true;
        end;
        if not denied then
          raise exception '% unexpectedly accessed %', client_role, table_name;
        end if;
      end loop;
      reset role;
      execute format('grant select on public.charging_locations, public.charging_evses,
        public.charging_connectors, public.source_poll_runs, public.evse_status_transitions to %I', client_role);
      execute format('set local role %I', client_role);
      foreach table_name in array array['charging_locations','charging_evses','charging_connectors',
        'source_poll_runs','evse_status_transitions'] loop
        execute format('select count(*) from public.%I', table_name) into visible_rows;
        if visible_rows <> 0 then
          raise exception 'RLS exposed % rows in % to %', visible_rows, table_name, client_role;
        end if;
      end loop;
      reset role;
    end if;
  end loop;
end;
$$;

rollback;
\echo charging_foundation assertions passed; test data rolled back
