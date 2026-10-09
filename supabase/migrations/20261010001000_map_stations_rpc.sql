-- TASK-005: Read-only map stations RPC.
-- Grants anon EXECUTE on a SECURITY DEFINER function that returns
-- pre-aggregated station data. No table RLS policies are modified.
begin;

create or replace function public.get_map_stations(
  min_lng double precision default -180,
  max_lng double precision default 180,
  min_lat double precision default -90,
  max_lat double precision default 90,
  connector_standards text[] default null,
  min_power_kw integer default null
)
returns table (
  location_id uuid,
  name text,
  operator_name text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  total_evse_count bigint,
  available_evse_count bigint,
  charging_evse_count bigint,
  unavailable_evse_count bigint,
  unknown_evse_count bigint,
  connector_types text[],
  max_power_kw integer,
  last_observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  result_count bigint;
begin
  -- NULL, NaN, infinities, reversed bounds and out-of-range coordinates
  -- must fail instead of silently producing an empty or unrestricted query.
  if min_lng is null or max_lng is null or min_lat is null or max_lat is null
    or not (min_lng between -180 and 180)
    or not (max_lng between -180 and 180)
    or not (min_lat between -90 and 90)
    or not (max_lat between -90 and 90)
    or min_lng > max_lng or min_lat > max_lat then
    raise exception using errcode = '22023', message = 'Invalid map bounds';
  end if;
  if min_power_kw is not null and not (min_power_kw between 0 and 1000) then
    raise exception using errcode = '22023', message = 'Power must be between 0 and 1000 kW';
  end if;
  if connector_standards is not null then
    if coalesce(pg_catalog.array_ndims(connector_standards), 1) <> 1
      or pg_catalog.cardinality(connector_standards) > 32
      or exists (
        select 1 from pg_catalog.unnest(connector_standards) as s(standard)
        where s.standard is null or pg_catalog.length(s.standard) > 64
          or s.standard !~ '^[A-Z0-9_]+$'
      ) then
      raise exception using errcode = '22023', message = 'Invalid connector standards';
    end if;
  end if;

  return query
  select
    l.id as location_id,
    l.name,
    l.operator_name,
    l.address,
    l.city,
    l.latitude,
    l.longitude,
    count(distinct e.id) as total_evse_count,
    count(distinct e.id) filter (
      where e.current_status = 'AVAILABLE'
    ) as available_evse_count,
    count(distinct e.id) filter (
      where e.current_status = 'CHARGING'
    ) as charging_evse_count,
    count(distinct e.id) filter (
      where e.current_status in ('BLOCKED', 'INOPERATIVE', 'OUTOFORDER', 'REMOVED')
    ) as unavailable_evse_count,
    count(distinct e.id) filter (
      where e.current_status in ('UNKNOWN', 'PLANNED', 'RESERVED')
    ) as unknown_evse_count,
    array_agg(distinct c.standard) filter (where c.standard is not null) as connector_types,
    max(c.rated_power_w / 1000) as max_power_kw,
    max(e.last_observed_at) as last_observed_at
  from public.charging_locations l
  join public.charging_evses e on e.location_id = l.id
  left join public.charging_connectors c on c.evse_id = e.id
  where l.latitude is not null
    and l.longitude is not null
    and l.latitude between min_lat and max_lat
    and l.longitude between min_lng and max_lng
    and (
      connector_standards is null
      or exists (
        select 1 from public.charging_connectors cf
        where cf.evse_id = e.id
          and cf.standard = any(connector_standards)
      )
    )
    and (
      min_power_kw is null
      or exists (
        select 1 from public.charging_connectors cp
        where cp.evse_id = e.id
          and cp.rated_power_w >= min_power_kw * 1000
      )
    )
  group by l.id, l.name, l.operator_name, l.address, l.city, l.latitude, l.longitude
  order by l.id
  limit 2001;

  get diagnostics result_count = row_count;
  if result_count > 2000 then
    -- Fail the whole request; never return a silently incomplete map.
    raise exception using errcode = '22023', message = 'Too many stations; narrow the map bounds';
  end if;
end;
$$;

comment on function public.get_map_stations is
  'Read-only map endpoint. Validated geographic bounds, up to 32 connector standards and 0-1000 kW. Returns at most 2000 stations; rejects larger results. Counts reflect EVSEs matching filters. No source metadata, poll diagnostics or credentials exposed. No table policies are added.';

-- Functions otherwise inherit PostgreSQL default PUBLIC EXECUTE.
revoke all on function public.get_map_stations(
  double precision, double precision, double precision, double precision,
  text[], integer
) from public;

-- Grant anon EXECUTE so the public Supabase API key can call this function.
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    revoke all on function public.get_map_stations(
      double precision, double precision, double precision, double precision,
      text[], integer
    ) from anon;
    grant execute on function public.get_map_stations(
      double precision, double precision, double precision, double precision,
      text[], integer
    ) to anon;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    revoke all on function public.get_map_stations(
      double precision, double precision, double precision, double precision,
      text[], integer
    ) from authenticated;
    grant execute on function public.get_map_stations(
      double precision, double precision, double precision, double precision,
      text[], integer
    ) to authenticated;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke all on function public.get_map_stations(
      double precision, double precision, double precision, double precision,
      text[], integer
    ) from service_role;
  end if;
end;
$$;

commit;
