-- Read-only verification AFTER separately approved migration deployment.
-- No synthetic measurements, grants, schema changes or collector calls.
begin read only;
do $$
declare
  target_id uuid;
  row record;
  item jsonb;
  canonical public.charging_evses%rowtype;
  expected jsonb;
begin
  select l.id into target_id from public.charging_locations l
  where l.city = 'Vilnius' and l.position is not null
    and exists (select 1 from public.charging_evses e where e.location_id = l.id)
  order by l.id limit 1;
  if target_id is null then raise exception 'No Vilnius test target'; end if;
  if not exists (select 1 from public.get_station_capacity(target_id) r
    where (r.station->>'location_id')::uuid = target_id) then
    raise exception 'Target absent';
  end if;
  if (select count(*) from public.get_station_capacity(target_id)) <> (
    select count(*) from public.charging_locations l
    join public.charging_locations t on t.id = target_id
    where extensions.st_dwithin(l.position, t.position, 10100)
      and exists (select 1 from public.charging_evses e where e.location_id = l.id)
  ) then raise exception 'Spatial result incomplete'; end if;
  for row in select * from public.get_station_capacity(target_id) loop
    if exists (select 1 from jsonb_object_keys(row.station) k where k <> all(array[
      'location_id', 'name', 'operator_name', 'address', 'city', 'latitude', 'longitude',
      'total_evse_count', 'available_evse_count', 'charging_evse_count', 'unavailable_evse_count',
      'unknown_evse_count', 'connector_types', 'max_power_kw', 'last_observed_at'
    ])) then raise exception 'Unexpected station metadata exposed'; end if;
    if jsonb_array_length(row.evses) <> (select count(*) from public.charging_evses e
      where e.location_id = (row.station->>'location_id')::uuid) then
      raise exception 'Missing EVSE evidence';
    end if;
    if jsonb_array_length(row.evses) <> (select count(distinct e->>'id') from jsonb_array_elements(row.evses) e) then
      raise exception 'Duplicate EVSE capacity';
    end if;
    if (row.station->>'available_evse_count')::integer <> (
      select count(*) from jsonb_array_elements(row.evses) e where e->>'status' = 'AVAILABLE'
    ) then raise exception 'Incorrect available count'; end if;
    for item in select * from jsonb_array_elements(row.evses) loop
      if exists (select 1 from jsonb_object_keys(item) k where k <> all(array[
        'id', 'status', 'observed_at', 'connector_standards'
      ])) then raise exception 'Unexpected EVSE metadata exposed'; end if;
      select * into strict canonical from public.charging_evses where id = (item->>'id')::uuid;
      if canonical.location_id <> (row.station->>'location_id')::uuid
        or canonical.current_status <> item->>'status'
        or canonical.last_observed_at <> (item->>'observed_at')::timestamptz then
        raise exception 'Evidence differs from canonical EVSE';
      end if;
      select coalesce(jsonb_agg(distinct c.standard), '[]'::jsonb) into expected
      from public.charging_connectors c where c.evse_id = canonical.id and c.standard is not null;
      if not ((item->'connector_standards') @> expected and expected @> (item->'connector_standards')) then
        raise exception 'Connector association differs';
      end if;
    end loop;
  end loop;
  begin
    perform public.get_station_capacity(null);
    raise exception 'NULL input accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.get_station_capacity('00000000-0000-0000-0000-000000000000');
    raise exception 'Missing target accepted';
  exception when invalid_parameter_value then null;
  end;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_station_capacity'
      and (not p.prosecdef or p.provolatile <> 's' or p.proconfig <> array['search_path=pg_catalog, pg_temp'])) then
    raise exception 'Function security configuration differs';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
    lateral aclexplode(p.proacl) a
    where n.nspname = 'public' and p.proname = 'get_station_capacity' and a.grantee = 0) then
    raise exception 'PUBLIC function access';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    cross join (values ('anon'), ('authenticated')) roles(name)
    where n.nspname = 'public' and c.relname in ('charging_locations', 'charging_evses',
      'charging_connectors', 'source_poll_runs', 'evse_status_transitions')
      and (not c.relrowsecurity or has_table_privilege(roles.name, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
  ) then raise exception 'Client table privileges or RLS unsafe'; end if;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform public.get_station_capacity(null);
    raise exception 'NULL input accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.charging_evses limit 1;
    raise exception 'anon direct access allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.charging_connectors limit 1;
    raise exception 'anon connector access allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
