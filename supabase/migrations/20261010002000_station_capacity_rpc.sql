-- TASK-006: bounded read-only evidence endpoint. Apply only after approval.
begin;
create function public.get_station_capacity(target_location_id uuid)
returns table (station jsonb, evses jsonb)
language plpgsql stable security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  target public.charging_locations%rowtype;
  result_count bigint;
begin
  if target_location_id is null then
    raise exception using errcode = '22023', message = 'Station ID required';
  end if;
  select * into target from public.charging_locations where id = target_location_id;
  if not found or target.latitude is null then
    raise exception using errcode = '22023', message = 'Station not found or coordinates missing';
  end if;
  return query
  select pg_catalog.jsonb_build_object(
    'location_id', l.id, 'name', l.name, 'operator_name', l.operator_name,
    'address', l.address, 'city', l.city, 'latitude', l.latitude, 'longitude', l.longitude,
    'total_evse_count', evidence.total,
    'available_evse_count', evidence.available,
    'charging_evse_count', evidence.charging,
    'unavailable_evse_count', evidence.unavailable,
    'unknown_evse_count', evidence.unknown,
    'connector_types', connectors.standards,
    'max_power_kw', connectors.power_kw,
    'last_observed_at', evidence.observed_at
  ), evidence.items
  from public.charging_locations l
  cross join lateral (
    select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', e.id, 'status', e.current_status, 'observed_at', e.last_observed_at,
      'connector_standards', coalesce((
        select pg_catalog.jsonb_agg(distinct c.standard)
        from public.charging_connectors c where c.evse_id = e.id and c.standard is not null
      ), '[]'::jsonb)
    ) order by e.id) as items,
    count(*) as total,
    count(*) filter (where e.current_status = 'AVAILABLE') as available,
    count(*) filter (where e.current_status = 'CHARGING') as charging,
    count(*) filter (where e.current_status in ('BLOCKED', 'INOPERATIVE', 'OUTOFORDER', 'REMOVED')) as unavailable,
    count(*) filter (where e.current_status in ('UNKNOWN', 'PLANNED', 'RESERVED')) as unknown,
    max(e.last_observed_at) as observed_at
    from public.charging_evses e where e.location_id = l.id
  ) evidence
  cross join lateral (
    select pg_catalog.jsonb_agg(distinct c.standard) filter (where c.standard is not null) as standards,
      max(c.rated_power_w / 1000) as power_kw
    from public.charging_evses e join public.charging_connectors c on c.evse_id = e.id
    where e.location_id = l.id
  ) connectors
  where extensions.st_dwithin(l.position, target.position, 10100) and evidence.total > 0
  order by l.id
  limit 2001;
  get diagnostics result_count = row_count;
  if result_count > 2000 then
    raise exception using errcode = '22023', message = 'Too many nearby stations';
  end if;
end;
$$;
revoke all on function public.get_station_capacity(uuid) from public;
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    grant execute on function public.get_station_capacity(uuid) to anon;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_station_capacity(uuid) to authenticated;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    revoke all on function public.get_station_capacity(uuid) from service_role;
  end if;
end;
$$;
comment on function public.get_station_capacity(uuid) is
  'Read-only nearby station evidence. Canonical EVSE ID, status, observation time and connector standards only. No direct table grants or RLS changes. Client applies 10 km great-circle limit; SQL uses 10.1 km geodesic envelope.';
commit;
