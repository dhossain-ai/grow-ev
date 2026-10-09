# TASK-004A — Charging Data Model and Database Foundation

Status: Complete — verified cloud foundation finalized in Git
Priority: P0

## Completed scope

- Five PostgreSQL tables for locations, EVSEs, connectors, source polls and
  observed status transitions.
- Canonical source identities, scoped foreign keys, upsert keys and history
  indexes. Public EVSE IDs are nonunique.
- Raw source timestamp text alongside nullable interpreted timestamps; reliable
  system observations use `timestamptz`.
- WGS84 geography generated from validated coordinates, indexed with GiST.
- RLS enabled, client access denied and narrow conditional service-role grants.
- Rollback-only SQL regression tests and concise data-model/status documentation.

No application, map, live collection, routing, migration deployment, ingestion
service, recommendation or ML changes. No new dependencies or credentials.

## Decisions

EVSE identity is `(source, country_code, party_id, uid)`, independent of location.
Locations use `(source, country_code, party_id, ocpi_location_id)` and connectors
use `(evse_id, connector_id)`. Normalize numeric wire IDs to text during future
ingestion. Keep operator details on locations rather than introducing a sixth
table. Transitions store ordered observation bounds and original statuses; they
do not imply session completion or idling. Poll completeness is feed-traversal
completeness, never a claim of full national coverage.

One transition per EVSE/run supports retries without duplicated history. Future
ingestion must serialize state changes and transactionally update current state
and transitions. Immutable event time and first-seen rules are writer duties.
No stored ingestion procedures or analytics tables were introduced.

## Files

- `supabase/migrations/20261009000100_charging_foundation.sql`
- `supabase/tests/charging_foundation.sql`
- `docs/DATA_MODEL.md`
- `docs/STATUS.md`
- This task record.

## Verification actually performed

### Final cloud verification — 2026-10-10

- User approved the actual push after target inspection and dry-run.
- `npx supabase db push --yes` passed on `heafsrqaytsfthfcxmqu`;
  migration history records `20261009000100`.
- All five expected tables exist with RLS enabled. PostGIS is installed in
  `extensions`; existing service-role schema USAGE was verified.
- Actual versions: PostgreSQL **17.11**, PostGIS **3.3.7** (extension build
  `a0c7967`), GEOS 3.14.1, PROJ 9.7.1.
- Enhanced SQL regression suite to execute as anon/authenticated, checking
  actual permission denial and zero visible fixture rows under default-deny RLS
  after transaction-local SELECT grants. Grants and fixtures roll back.
- Ran the complete SQL suite twice using
  `npx supabase db query --linked --file <temporary SQL file>`: both passed.
  The temporary UTF-8 file contains the repository test with only psql
  meta-command lines removed and a success SELECT appended after ROLLBACK.
  All database assertions remain unchanged in that transport copy.
- Verified after both runs: all five table counts are zero and anon/authenticated
  SELECT/INSERT/UPDATE/DELETE privileges remain denied.
- Verified canonical EVSE uniqueness across locations, duplicate public IDs,
  scoped foreign keys, connector identity, geographic queries/GiST, transitions,
  constraints, RLS and restricted service-role transition privileges.
- `git diff --check` passed. No application typecheck/build was run because no
  application code or dependencies changed. No second independent database
  setup was tested; the rollback suite was repeated on the confirmed cloud target.
- No secrets added, no remote reset, no commit, no TASK-004B work.

The entries below document earlier stages; their pending/unrun statements are
historical and superseded by the final cloud verification above.

2026-10-10 (cloud connection, in progress):
- Supabase CLI `2.106.0` verified with `npx supabase --version`.
- `npx supabase init` succeeded; added `supabase/config.toml` and
  `supabase/.gitignore`, preserving the existing migration and SQL tests.
- Opened a private interactive PowerShell window for `npx supabase login`;
  authentication and project selection are awaiting the user.
- Reviewed migration and test SQL: PostGIS uses `extensions`, foreign keys
  enforce source scope, geography is generated and indexed, and all five
  tables enable RLS with client privileges revoked. Live compatibility remains
  unverified. Tests use BEGIN/ROLLBACK and temporary assertion helpers;
  psql meta-commands need removal if executed using SQL Editor or CLI db query.
- `git diff --check` passed. Existing TASK-003 changes preserved.
- No remote migration, reset, SQL tests or commit performed. Dry-run and
  explicit push confirmation remain pending target verification.

Cloud preflight completed after interactive authentication:
- User confirmed `heafsrqaytsfthfcxmqu` is the intended disposable Grow EV
  development project. Local link matches that ref; account lists it healthy
  in `eu-central-1`, created 2026-10-09.
- `npx supabase db query --linked` verified PostgreSQL 17.11, no public tables,
  no migration history table at initial inspection, and no installed PostGIS.
  `service_role` has extensions-schema USAGE and bypasses RLS; anon and
  authenticated do not bypass RLS.
- `npx supabase migration list --linked` showed no applied remote migration.
- `npx supabase db push --dry-run` passed and would apply only
  `20261009000100_charging_foundation.sql`.
- Actual push, PostGIS version and live regression results remain pending
  explicit user confirmation. No remote reset or commit performed.

2026-10-09:
- Read required documents, existing OCPI parser and representative fixture.
- Inspected Git state and preserved uncommitted TASK-003 changes.
- Checked Windows commands/services/ports, common PostgreSQL/Docker installation
  paths, Supabase CLI via npx, and WSL Ubuntu environment:
  - Docker is not installed or running on Windows or WSL.
  - `npx supabase start` fails due to missing Docker engine pipe.
  - No active PostgreSQL/PostGIS server or client exists on Windows or WSL.
  - Smallest practical setup option identified: lightweight PostgreSQL 16 + PostGIS 3.4
    packages in WSL2 Ubuntu (`postgresql`, `postgresql-16-postgis-3`, ~70MB download).
    Per instructions, automatic installation was not performed without authorization.
- Static schema review completed by PostgreSQL/PostGIS engineer:
  - Verified 5 core tables, primary keys, and composite tenant/source foreign keys.
  - Verified PostGIS geography point generated column `(longitude, latitude, 4326)` and GiST index.
  - Verified RLS default-deny and restricted service-role privileges.
- SQL test enhancements:
  - Added explicit privilege verification for the universal `public` role across all 5 tables
    in `supabase/tests/charging_foundation.sql`, ensuring nonprivileged access denial is
    tested even in environments lacking Supabase `anon`/`authenticated` roles.
- `git diff --check` — passed.

**Database version tested:** None (runtime execution withheld pending database setup).
**PostGIS version tested:** None.
**Migration result:** Static verification passed; live DDL unrun.
**SQL test results:** Unrun (0/10 live checks executed; no SQL test claimed passed).
**Fixes/enhancements:** Added `public` role privilege assertion loop in SQL regression suite.
**Remaining limitations:** Real PostgreSQL/PostGIS execution unverified until a disposable
database is provisioned via the reported smallest setup option.

## Assumptions and review gates

- PostgreSQL 15+ with PostGIS available; extension schema `extensions`.
- Supabase roles are optional locally; service_role bypasses RLS in Supabase.
- Unknown source timezone stays unresolved; interpreted source times remain NULL.
- The public feed's completeness and DATEX mapping are still unresolved.
- Migration is versioned and applied once; use an empty disposable database for
  testing. Tests roll back and can be repeated. See commands in `DATA_MODEL.md`.

No changes committed. TASK-004B was not started. Cloud foundation verification
is complete; stop and wait for review.
