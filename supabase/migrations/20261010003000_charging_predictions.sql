-- PROPOSAL ONLY. Exact target: DEV heafsrqaytsfthfcxmqu. Live application requires approval.
begin;
create table public.charging_predictions (
  prediction_id text primary key check (prediction_id ~ '^[0-9a-f]{64}$'),
  location_id uuid not null references public.charging_locations(id),
  connector_standard text not null check (connector_standard in ('IEC_62196_T2_COMBO','IEC_62196_T2','CHADEMO')),
  source_poll_id uuid not null references public.source_poll_runs(id),
  source_observed_at timestamptz not null,
  generated_at timestamptz not null,
  horizon text not null check (horizon = 'next_observation'),
  probability_zero_capacity double precision not null check (probability_zero_capacity between 0 and 1),
  model_version text not null check (model_version = 'availability_v1'),
  model_sha256 text not null check (model_sha256 ~ '^[0-9a-f]{64}$'),
  experimental boolean not null check (experimental),
  expires_at timestamptz not null,
  unique (location_id,connector_standard,source_poll_id,model_version),
  check (source_observed_at <= generated_at and generated_at < expires_at),
  check (expires_at <= source_observed_at + interval '1 hour')
);
alter table public.charging_predictions enable row level security;
revoke all on table public.charging_predictions from public, anon, authenticated;
grant select,insert on table public.charging_predictions to service_role;

create function public.get_charging_prediction(target_location_id uuid, target_connector_standard text)
returns table (prediction_id text,location_id uuid,connector_standard text,source_poll_id uuid,
  source_observed_at timestamptz,generated_at timestamptz,horizon text,
  probability_zero_capacity double precision,model_version text,model_sha256 text,
  experimental boolean,expires_at timestamptz)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp
as $$
begin
  if target_location_id is null or target_connector_standard is null or
     target_connector_standard not in ('IEC_62196_T2_COMBO','IEC_62196_T2','CHADEMO') then
    raise exception 'Invalid forecast request' using errcode='22023';
  end if;
  return query select p.prediction_id,p.location_id,p.connector_standard,p.source_poll_id,
    p.source_observed_at,p.generated_at,p.horizon,p.probability_zero_capacity,p.model_version,
    p.model_sha256,p.experimental,p.expires_at
  from public.charging_predictions p
  join public.source_poll_runs s on s.id=p.source_poll_id
  join public.charging_locations l on l.id=p.location_id and l.source=s.source
  where p.location_id=target_location_id and p.connector_standard=target_connector_standard
    and s.source='via-lietuva-ocpi' and s.outcome='SUCCESS' and s.completeness='COMPLETE'
    and s.pagination_metadata->>'verified'='true'
    and not (s.pagination_metadata ? 'replaySha256')
    and p.source_observed_at between s.started_at and s.completed_at
    and p.generated_at<=current_timestamp and p.expires_at>current_timestamp
    and p.source_observed_at<=current_timestamp
    -- A newer poll of any outcome invalidates the older outlook.
    and s.id=(select latest.id from public.source_poll_runs latest
      where latest.source=s.source order by latest.started_at desc limit 1)
  order by p.generated_at desc limit 1;
end;
$$;
revoke all on function public.get_charging_prediction(uuid,text) from public;
grant execute on function public.get_charging_prediction(uuid,text) to anon,authenticated,service_role;
comment on table public.charging_predictions is 'Experimental real CatBoost next-observation risk. No arrival or 30-minute claim. Private writes only.';
commit;
