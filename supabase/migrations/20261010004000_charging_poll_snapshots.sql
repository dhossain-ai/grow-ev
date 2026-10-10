-- TASK-015: private, immutable genuine poll history. No backfill or deletion.
begin;
create table public.charging_poll_snapshots (
  poll_run_id uuid primary key,
  source text not null,
  schema_version smallint not null check (schema_version = 1),
  observed_oldest_at timestamptz not null,
  observed_newest_at timestamptz not null,
  location_count integer not null check (location_count >= 0),
  evse_count integer not null check (evse_count >= 0),
  connector_count integer not null check (connector_count >= 0),
  payload_gzip bytea not null check (octet_length(payload_gzip) between 1 and 8388608),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  foreign key (poll_run_id, source) references public.source_poll_runs(id, source),
  check (observed_oldest_at <= observed_newest_at)
);
comment on table public.charging_poll_snapshots is
  'Immutable gzip JSON schema 1: exact fetched canonical membership, statuses, connector topology, observation times and verified poll metadata. Inserted atomically with successful genuine publication. Never backfilled from retained state.';
create function public.validate_charging_poll_snapshot()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
declare p public.source_poll_runs;
begin
  if tg_op <> 'INSERT' then raise exception 'Poll snapshots are immutable'; end if;
  select * into p from public.source_poll_runs where id=new.poll_run_id and source=new.source for share;
  if p.id is null or p.outcome<>'SUCCESS' or p.completeness<>'COMPLETE'
    or p.pagination_metadata->>'verified' is distinct from 'true'
    or p.pagination_metadata->>'duplicates' is distinct from '0'
    or p.pagination_metadata ? 'replaySha256'
    or new.observed_oldest_at<p.started_at or new.observed_newest_at>p.completed_at
    or new.location_count is distinct from (p.pagination_metadata->'counts'->>'locations')::integer
    or new.evse_count is distinct from (p.pagination_metadata->'counts'->>'evses')::integer
    or new.connector_count is distinct from (p.pagination_metadata->'counts'->>'connectors')::integer then
    raise exception 'Snapshot requires verified complete poll, exact counts and valid chronology';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_charging_poll_snapshot() from public;
create trigger charging_poll_snapshot_valid before insert or update on public.charging_poll_snapshots
  for each row execute function public.validate_charging_poll_snapshot();
alter table public.charging_poll_snapshots enable row level security;
revoke all on public.charging_poll_snapshots from public;
do $$
declare client_role text;
begin
  foreach client_role in array array['anon','authenticated','service_role'] loop
    if exists(select 1 from pg_roles where rolname=client_role) then
      execute format('revoke all on public.charging_poll_snapshots from %I',client_role);
    end if;
  end loop;
  if exists(select 1 from pg_roles where rolname='service_role') then
    grant select,insert on public.charging_poll_snapshots to service_role;
  end if;
end;
$$;
commit;
