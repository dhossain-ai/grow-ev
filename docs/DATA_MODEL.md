# Grow EV — Data Model

Status: TASK-004A cloud migration and PostgreSQL/PostGIS tests verified 2026-10-10
Version: 0.2

Migration: `supabase/migrations/20261009000100_charging_foundation.sql`.
Migration verified against remote migration-history SQL and finalized in Git. Applied to the
user-confirmed disposable Supabase project `heafsrqaytsfthfcxmqu`.

## Implemented tables

| Table | Purpose | Idempotent identity |
| --- | --- | --- |
| `charging_locations` | Source identity, operator details, address, geography and observation times | `(source, country_code, party_id, ocpi_location_id)` |
| `charging_evses` | Technical identity, current normalized/original status and observations | `(source, country_code, party_id, uid)` |
| `charging_connectors` | Technical connector options and tariff references | `(evse_id, connector_id)` |
| `source_poll_runs` | Poll timing, outcome, traversal completeness, counts, pagination evidence and errors | UUID assigned once per run, reused for updates |
| `evse_status_transitions` | Observed changes and the interval between observations | `(evse_id, poll_run_id)` |

All internal primary keys are UUIDs. Source is a stable feed identifier,
separate from the versioned endpoint URL. Future ingestion converts numeric
wire identifiers losslessly to text. Public `evse_id` is deliberately nonunique.

An EVSE retains its canonical identity when its location changes. Its composite
foreign key requires the location's source, country and party to match.
Transitions similarly enforce matching EVSE and poll sources. Foreign keys
prevent deletion of referenced records; no cascade deletion is configured.

Operator names/websites stay on locations; source/country/party identifies the
operator in this feed. A separate operator table is deferred. Small JSON objects
retain relevant published metadata, without storing full feed responses.

## Status and timestamp semantics

`current_status` recognizes AVAILABLE, BLOCKED, CHARGING, INOPERATIVE,
OUTOFORDER, PLANNED, REMOVED, RESERVED and UNKNOWN. INOPERATIVE is separate from
OUTOFORDER. Future ingestion maps missing/unrecognized values to UNKNOWN and
preserves the exact original `source_status` (NULL when missing).
UNKNOWN never implies availability. Neither CHARGING nor long occupancy proves
charging completion or post-charge idling.

Locations and EVSEs require explicit, ordered `first_observed_at` and
`last_observed_at` as `timestamptz`. Each source update has original
`source_last_updated_text` and nullable `source_last_updated_at`.
Leave the latter NULL while the timezone is uncertain; never cast offset-free
text using the database session's timezone.

Transitions preserve previous/new normalized and original statuses, previous/new
observation times, the observing poll and the new source timestamp. The actual
change occurred between observations; neither bound is an exact transition
time. First observation creates no fabricated transition. Original status
changes can be retained even when both normalized values are UNKNOWN.

Only changes are stored, not every unchanged observation. Partial or failed
polls cannot prove every EVSE was observed. Historical occupancy episodes will
need interval/gap uncertainty; they are not implemented in TASK-004A.

## Polling history and future writer responsibilities

Outcome is RUNNING, SUCCESS or FAILURE. Completeness is UNKNOWN, PARTIAL or
COMPLETE. Successful requests can still be partial. COMPLETE means validated
traversal of the requested feed scope, never complete national coverage.
Advertised totals are diagnostic; do not equate them with unique locations.
Small paging metadata records offsets, returned counts, headers and validation
notes. FAILURE requires an error description. Unfinished RUNNING rows expose
interrupted polls. Zero initial counters mean a run has not retrieved records
yet, not that a missing source measurement was zero.

TASK-004B must validate external values; update observation times only for
validated records; preserve first-seen times and last good state; serialize
competing state updates; and record current state plus transitions atomically.
Do not erase unseen records after a partial response. Cross-row chronology and
poll-success checks remain writer responsibilities. No ingestion triggers,
stored service procedures or ingestion code exist.

## Connectors and geography

Connector identifiers are scoped to their EVSE. Standards, formats and power
types retain source text. Optional power, voltage and amperage remain NULL when
missing; validated values must be positive. Rated power is published maximum
watts, not measured power or a constant charging rate. Capacity counts EVSEs,
not connector options.

Tariffs are source references scoped through EVSE/operator identity. NULL means
missing references; an empty array means explicitly none. No tariff prices or
pricing calculations are stored yet.

Latitude/longitude are nullable together, constrained to geographic ranges.
A stored generated WGS84 `geography(Point,4326)` uses longitude first, with
a GiST index for radius queries. Missing coordinates remain NULL. Road routing
and administrative-boundary classification are not implemented.

## Database security and setup

PostGIS is installed in `extensions`. The migration fails if an existing
installation uses another schema rather than relocating it implicitly.

RLS is enabled on all five tables with no client policies. PUBLIC, anon and
authenticated have no direct grants. Existing service_role receives
SELECT/INSERT/UPDATE on current-state/run tables and SELECT/INSERT on transitions;
no DELETE or transition UPDATE grants are added. Vanilla PostgreSQL need not
have Supabase roles. Supabase's service_role bypasses RLS; credentials stay
server-side. Future client reads require a separately reviewed API/policy.
See [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
and [PostGIS setup](https://supabase.com/docs/guides/database/extensions/postgis).

On an explicitly disposable, empty PostgreSQL 15+ database with PostGIS available:

```powershell
psql --dbname growev_task004a_test --set ON_ERROR_STOP=1 --file supabase/migrations/20261009000100_charging_foundation.sql
psql --dbname growev_task004a_test --set ON_ERROR_STOP=1 --file supabase/tests/charging_foundation.sql
```

Tests roll back data/helpers and can run twice. Reproduce clean setup in a
second empty database. Supabase migration history applies the version once;
replaying DDL on an existing schema intentionally fails instead of masking drift.

Cloud verification used PostgreSQL 17.11 / PostGIS 3.3.7. The complete SQL suite
passed twice through `npx supabase db query --linked --file` using a temporary
copy with psql meta-commands removed. Constraints, spatial operations, ACLs and
actual anon/authenticated default-deny RLS were verified. All fixture rows and
temporary grants rolled back; all five tables remained empty. Independent
setup in a second database was not run. Local Windows/WSL runtime remains absent.

## TASK-006 public read contract (approved deployment blocked by connectivity)

New migration `20261010002000_station_capacity_rpc.sql` adds
`get_station_capacity(target_location_id uuid)`, a STABLE read-only SECURITY
DEFINER endpoint with trusted search path and explicit anon/authenticated
EXECUTE grants. No table grants, RLS policies, schema entities or ingestion
behavior change. Existing applied migrations remain untouched.

Returns `station` (the same field meanings as the map RPC) plus `evses`, one
record per canonical EVSE: `id`, normalized `status`, `observed_at`, and
`connector_standards` belonging to that EVSE. Null standards are omitted; an
empty array supplies no compatibility evidence. Canonical IDs prevent duplicated
public EVSE identifiers or multiple connectors from inflating capacity.
Observation times retain per-EVSE freshness rather than the station maximum.
No source metadata, poll diagnostics or tariff references are exposed.

Requires an existing geolocated station; rejects null/missing IDs. Spatial
lookup uses indexed PostGIS geography within 10.1 km (a conservative envelope
for the client's exact 10 km spherical distance check). Results are ordered by
canonical location ID and reject more than 2,000 stations rather than truncate.
Clients page PostgREST responses and reject incomplete/duplicate evidence.
The unchanged migration and `supabase/tests/station_capacity_live.sql` pass on
disposable local PostgreSQL 16.15 / PostGIS 3.4.2. The SQL test's JSON operator
precedence was corrected and security/allowlist/spatial assertions strengthened.
User approved DEV deployment conditionally; CLI dry-run/database TCP timeouts
prevent confirming the pending list, so remote application/verification has not run.

## Deferred entities (unchanged)

Separate operators, tariffs, raw per-EVSE observations, occupancy episodes,
station metrics, vehicles, recommendations and community reports remain future
design work. No speculative tables for these entities are part of TASK-004A.
