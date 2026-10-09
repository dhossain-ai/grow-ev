-- Read-only verification against existing DEV data, after approved deployment.
-- No fixtures, grants, ingestion changes or simulated measurements.
begin read only;

do $$
begin
  if exists (
    select 1 from public.get_map_stations() as m
    where m.total_evse_count <> (
      select count(*) from public.charging_evses e where e.location_id = m.location_id
    ) or m.available_evse_count <> (
      select count(*) from public.charging_evses e
      where e.location_id = m.location_id and e.current_status = 'AVAILABLE'
    ) or m.charging_evse_count <> (
      select count(*) from public.charging_evses e
      where e.location_id = m.location_id and e.current_status = 'CHARGING'
    ) or m.unavailable_evse_count <> (
      select count(*) from public.charging_evses e
      where e.location_id = m.location_id
        and e.current_status in ('BLOCKED', 'INOPERATIVE', 'OUTOFORDER', 'REMOVED')
    ) or m.unknown_evse_count <> (
      select count(*) from public.charging_evses e
      where e.location_id = m.location_id and e.current_status in ('UNKNOWN', 'PLANNED', 'RESERVED')
    )
  ) then
    raise exception 'RPC EVSE counts do not match existing database data';
  end if;
  if (select count(*) from public.get_map_stations()) <> (
    select count(*) from public.charging_locations l
    where l.latitude is not null and l.longitude is not null
      and exists (select 1 from public.charging_evses e where e.location_id = l.id)
  ) then
    raise exception 'RPC station count does not match existing database data';
  end if;
end;
$$;

set local role anon;
do $$
begin
  perform 1 from public.get_map_stations(25.1, 25.5, 54.5, 54.9);
  begin
    perform 1 from public.charging_locations limit 1;
    raise exception 'anon unexpectedly has direct location access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.charging_evses limit 1;
    raise exception 'anon unexpectedly has direct EVSE access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.charging_connectors limit 1;
    raise exception 'anon unexpectedly has direct connector access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.source_poll_runs limit 1;
    raise exception 'anon unexpectedly has direct poll access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.evse_status_transitions limit 1;
    raise exception 'anon unexpectedly has direct transition access';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.get_map_stations(min_lng => 'NaN'::double precision);
    raise exception 'NaN bounds accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(min_lat => null);
    raise exception 'NULL bounds accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(min_lng => 26, max_lng => 25);
    raise exception 'Reversed bounds accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(min_lat => -91);
    raise exception 'Out-of-range bounds accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(min_power_kw => 2147483647);
    raise exception 'Unbounded power accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(connector_standards => array[null]::text[]);
    raise exception 'NULL connector accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform 1 from public.get_map_stations(connector_standards => array_fill('CCS'::text, array[33]));
    raise exception 'Unbounded connector array accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
reset role;
rollback;
