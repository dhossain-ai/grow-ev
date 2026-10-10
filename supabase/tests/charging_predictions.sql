-- Explicit fixture data in a disposable local database only. Entire test rolls back.
begin;
insert into public.source_poll_runs(id,source,started_at,completed_at,outcome,completeness,pagination_metadata)
values ('10000000-0000-0000-0000-000000000001','via-lietuva-ocpi',current_timestamp-interval '5 minutes',
 current_timestamp-interval '3 minutes','SUCCESS','COMPLETE','{"verified":true}');
insert into public.charging_locations(id,source,country_code,party_id,ocpi_location_id,first_observed_at,last_observed_at)
values ('20000000-0000-0000-0000-000000000001','via-lietuva-ocpi','LT','TEST','fixture',
 current_timestamp-interval '4 minutes',current_timestamp-interval '4 minutes');
insert into public.charging_predictions values(repeat('a',64),'20000000-0000-0000-0000-000000000001',
 'IEC_62196_T2_COMBO','10000000-0000-0000-0000-000000000001',current_timestamp-interval '4 minutes',
 current_timestamp-interval '2 minutes','next_observation',0.65,'availability_v1',repeat('b',64),true,current_timestamp+interval '56 minutes');
do $$
begin
 if not (select relrowsecurity from pg_class where oid='public.charging_predictions'::regclass) then raise exception 'RLS disabled'; end if;
 if has_table_privilege('anon','public.charging_predictions','SELECT,INSERT,UPDATE,DELETE') or
    has_table_privilege('authenticated','public.charging_predictions','SELECT,INSERT,UPDATE,DELETE') then raise exception 'Client table privilege'; end if;
 if has_function_privilege('public','public.get_charging_prediction(uuid,text)','EXECUTE') then raise exception 'PUBLIC execute'; end if;
 if (select count(*) from public.get_charging_prediction('20000000-0000-0000-0000-000000000001','IEC_62196_T2_COMBO'))<>1 then raise exception 'Missing published forecast'; end if;
 begin
  perform public.get_charging_prediction(null,'BAD'); raise exception 'Invalid request accepted';
 exception when invalid_parameter_value then null; end;
 begin
  update public.charging_predictions set probability_zero_capacity='NaN'; raise exception 'NaN accepted';
 exception when check_violation then null; end;
 begin
  update public.charging_predictions set expires_at=source_observed_at+interval '2 hours'; raise exception 'Extended expiry accepted';
 exception when check_violation then null; end;
end; $$;
set local role anon;
do $$ begin
 if (select count(*) from public.get_charging_prediction('20000000-0000-0000-0000-000000000001','IEC_62196_T2_COMBO'))<>1 then raise exception 'Anonymous RPC failed'; end if;
 begin perform count(*) from public.charging_predictions; raise exception 'Anonymous direct read accepted'; exception when insufficient_privilege then null; end;
 begin update public.charging_predictions set probability_zero_capacity=0; raise exception 'Anonymous write accepted'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
insert into public.charging_predictions select * from public.charging_predictions
on conflict(location_id,connector_standard,source_poll_id,model_version) do nothing;
do $$ begin if (select count(*) from public.charging_predictions)<>1 then raise exception 'Idempotency failed'; end if; end; $$;
update public.charging_predictions set generated_at=current_timestamp-interval '2 hours 1 minute',
source_observed_at=current_timestamp-interval '3 hours',expires_at=current_timestamp-interval '2 hours 30 seconds';
do $$ begin if exists(select * from public.get_charging_prediction('20000000-0000-0000-0000-000000000001','IEC_62196_T2_COMBO')) then raise exception 'Expired forecast exposed'; end if; end; $$;
update public.charging_predictions set source_observed_at=current_timestamp-interval '4 minutes',
generated_at=current_timestamp-interval '2 minutes',expires_at=current_timestamp+interval '56 minutes';
insert into public.source_poll_runs(id,source,started_at) values
('10000000-0000-0000-0000-000000000002','via-lietuva-ocpi',current_timestamp-interval '1 minute');
do $$ begin if exists(select * from public.get_charging_prediction('20000000-0000-0000-0000-000000000001','IEC_62196_T2_COMBO')) then raise exception 'Superseded forecast exposed'; end if; end; $$;
rollback;
