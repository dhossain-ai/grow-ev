-- Apply once through migration history, as the database owner.
-- This migration makes no claim about completeness of a public charging feed.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

-- Do not silently relocate an extension already used by another application.
do $$
begin
  if (select extnamespace from pg_extension where extname = 'postgis')
     <> 'extensions'::regnamespace then
    raise exception 'PostGIS must be installed in schema extensions before applying this migration';
  end if;
end;
$$;

create table public.source_poll_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source <> '' and source = btrim(source)),
  started_at timestamptz not null,
  completed_at timestamptz,
  outcome text not null default 'RUNNING'
    check (outcome in ('RUNNING', 'SUCCESS', 'FAILURE')),
  completeness text not null default 'UNKNOWN'
    check (completeness in ('UNKNOWN', 'PARTIAL', 'COMPLETE')),
  records_retrieved integer not null default 0 check (records_retrieved >= 0),
  pages_retrieved integer not null default 0 check (pages_retrieved >= 0),
  advertised_total_count integer check (advertised_total_count >= 0),
  requested_page_limit integer check (requested_page_limit > 0),
  pagination_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(pagination_metadata) = 'object'),
  error_information text,
  unique (id, source),
  check (completed_at is null or completed_at >= started_at),
  check ((outcome = 'RUNNING' and completed_at is null and completeness = 'UNKNOWN')
      or (outcome <> 'RUNNING' and completed_at is not null)),
  check (completeness <> 'COMPLETE' or outcome = 'SUCCESS'),
  check (outcome <> 'FAILURE' or nullif(btrim(error_information), '') is not null)
);

comment on column public.source_poll_runs.completeness is
  'Completeness of the requested traversal, not proof of complete national coverage. SUCCESS may be PARTIAL or UNKNOWN.';
comment on column public.source_poll_runs.pagination_metadata is
  'Small diagnostic object: requested offsets, returned counts, Link/X-Total-Count/X-Limit headers and validation notes. No full response bodies or secrets.';

create table public.charging_locations (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source <> '' and source = btrim(source)),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  party_id text not null check (party_id <> '' and party_id = btrim(party_id)),
  ocpi_location_id text not null
    check (ocpi_location_id <> '' and ocpi_location_id = btrim(ocpi_location_id)),
  operator_name text,
  operator_website text,
  name text,
  address text,
  city text,
  country text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  position extensions.geography(Point, 4326) generated always as (
    case when latitude is not null and longitude is not null then
      extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)::extensions.geography
    end
  ) stored,
  source_last_updated_text text,
  source_last_updated_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  constraint charging_locations_source_identity
    unique (source, country_code, party_id, ocpi_location_id),
  unique (id, source, country_code, party_id),
  check ((latitude is null) = (longitude is null)),
  check (last_observed_at >= first_observed_at)
);

create index charging_locations_position_gist on public.charging_locations using gist (position);
comment on column public.charging_locations.source_last_updated_at is
  'Nullable interpreted instant. Leave NULL when timezone is unverified; preserve original source text separately.';

create table public.charging_evses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  source text not null check (source <> '' and source = btrim(source)),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  party_id text not null check (party_id <> '' and party_id = btrim(party_id)),
  uid text not null check (uid <> '' and uid = btrim(uid)),
  public_evse_id text,
  current_status text not null default 'UNKNOWN'
    check (current_status in ('AVAILABLE', 'BLOCKED', 'CHARGING', 'INOPERATIVE',
      'OUTOFORDER', 'PLANNED', 'REMOVED', 'RESERVED', 'UNKNOWN')),
  source_status text,
  source_last_updated_text text,
  source_last_updated_at timestamptz,
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  constraint charging_evses_canonical_identity unique (source, country_code, party_id, uid),
  unique (id, source),
  constraint charging_evses_location_scope foreign key (location_id, source, country_code, party_id)
    references public.charging_locations (id, source, country_code, party_id),
  check (last_observed_at >= first_observed_at)
);

create index charging_evses_location_idx on public.charging_evses (location_id);
comment on column public.charging_evses.public_evse_id is
  'Public display/reference identifier; deliberately not unique. Canonical identity uses source/country_code/party_id/uid, independent of location.';
comment on column public.charging_evses.source_status is
  'Original source value, including unrecognized statuses; NULL means missing. Normalize unknown values to current_status UNKNOWN, never AVAILABLE.';

create table public.charging_connectors (
  id uuid primary key default gen_random_uuid(),
  evse_id uuid not null references public.charging_evses (id),
  connector_id text not null check (connector_id <> '' and connector_id = btrim(connector_id)),
  standard text,
  format text,
  power_type text,
  rated_power_w integer check (rated_power_w > 0),
  voltage numeric check (voltage > 0 and voltage < 'Infinity'::numeric),
  amperage numeric check (amperage > 0 and amperage < 'Infinity'::numeric),
  tariff_ids text[],
  source_last_updated_text text,
  source_last_updated_at timestamptz,
  unique (evse_id, connector_id),
  check (array_position(tariff_ids, null) is null and array_position(tariff_ids, '') is null)
);

comment on column public.charging_connectors.rated_power_w is
  'Published maximum rated watts; NULL means missing. Not measured power or guaranteed charging rate.';
comment on column public.charging_connectors.tariff_ids is
  'Source references only, scoped through the EVSE source/operator; NULL means missing, empty array means explicitly no references.';
comment on table public.charging_connectors is
  'Connector options within an EVSE. Independently usable capacity is counted by EVSE, not connector.';

create table public.evse_status_transitions (
  id uuid primary key default gen_random_uuid(),
  evse_id uuid not null,
  source text not null,
  poll_run_id uuid not null,
  previous_status text not null
    check (previous_status in ('AVAILABLE', 'BLOCKED', 'CHARGING', 'INOPERATIVE',
      'OUTOFORDER', 'PLANNED', 'REMOVED', 'RESERVED', 'UNKNOWN')),
  new_status text not null
    check (new_status in ('AVAILABLE', 'BLOCKED', 'CHARGING', 'INOPERATIVE',
      'OUTOFORDER', 'PLANNED', 'REMOVED', 'RESERVED', 'UNKNOWN')),
  previous_source_status text,
  new_source_status text,
  previous_observed_at timestamptz not null,
  new_observed_at timestamptz not null,
  source_last_updated_text text,
  source_last_updated_at timestamptz,
  constraint evse_status_transitions_evse_scope foreign key (evse_id, source)
    references public.charging_evses (id, source),
  constraint evse_status_transitions_poll_scope foreign key (poll_run_id, source)
    references public.source_poll_runs (id, source),
  unique (evse_id, poll_run_id),
  check (new_observed_at > previous_observed_at),
  check (previous_status <> new_status
    or previous_source_status is distinct from new_source_status)
);

create index evse_status_transitions_evse_time_idx
  on public.evse_status_transitions (evse_id, new_observed_at desc);
create index evse_status_transitions_poll_idx on public.evse_status_transitions (poll_run_id);
create index source_poll_runs_source_time_idx on public.source_poll_runs (source, started_at desc);

comment on table public.evse_status_transitions is
  'An observed change occurred between previous_observed_at and new_observed_at. Neither bound is an exact transition time. No event is fabricated for first observation.';

-- No client policies: default-deny even if table privileges are later granted.
alter table public.charging_locations enable row level security;
alter table public.charging_evses enable row level security;
alter table public.charging_connectors enable row level security;
alter table public.source_poll_runs enable row level security;
alter table public.evse_status_transitions enable row level security;

revoke all on public.charging_locations, public.charging_evses, public.charging_connectors,
  public.source_poll_runs, public.evse_status_transitions from public;

-- Vanilla PostgreSQL need not have Supabase roles. Do not create or alter them.
do $$
declare
  client_role text;
begin
  foreach client_role in array array['anon', 'authenticated', 'service_role'] loop
    if exists (select 1 from pg_roles where rolname = client_role) then
      execute format('revoke all on public.charging_locations, public.charging_evses,
        public.charging_connectors, public.source_poll_runs, public.evse_status_transitions from %I', client_role);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on public.charging_locations, public.charging_evses,
      public.charging_connectors, public.source_poll_runs to service_role;
    grant select, insert on public.evse_status_transitions to service_role;
  end if;
end;
$$;

commit;
