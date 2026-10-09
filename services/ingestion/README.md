# One-shot Via Lietuva collector

Requires Node 22.18+ (native TypeScript), PostgreSQL and server credentials.
Run from this directory. Nothing belongs in the Expo application.

```powershell
npm ci
npm run typecheck
npm test
node scripts/collect-ocpi.ts --dry-run --capture .scratch/verified-live.json
```

Copy `.env.example` to `.env.local`, set the **DEV** database connection URL
(URL-encode the password) and expected project ref. Use the direct PostgreSQL
connection or **session** pooler, port 5432; transaction pooling cannot retain
the collector's session lock. TLS verifies server certificates. Do not paste
credentials into logs, chat, Expo, command arguments or Git.

Set the URL value alone; do not paste a nested `DATABASE_URL=` assignment.
For Supabase's private CA, download the server root certificate from Database
Settings and set `GROW_EV_DATABASE_CA_FILE=.scratch/supabase-ca.crt` in `.env.local`.
The collector passes that CA to PostgreSQL while retaining certificate and hostname
verification. See [Supabase SSL verification](https://supabase.com/docs/guides/platform/ssl-enforcement).

```powershell
npm run collect -- --check
# First remote write requires explicit user permission.
npm run collect -- --capture .scratch/dev-run.json
# Replay the exact captured source rather than fetching changing live statuses.
npm run collect -- --replay .scratch/dev-run.json
```

Capture paths must be new: existing artifacts are never overwritten. Captures
are ignored generated data, with SHA-256 integrity checks on replay. Poll metadata
labels replay with its checksum. A replay is archival verification, not a fresh
live source measurement. `--dry-run` never connects to the database; `--check`
only reads schema/security. Do not use replay to refresh production status.

The source's advertised total bounds requested windows; it is not the location
count. The collector ignores malformed links, traverses short/empty intermediate
windows, requires a terminal empty window, then compares location/EVSE/connector
identity sets against a separate large-window request. Missing/changing counts,
conflicting duplicates, identity disagreement, invalid records, or the safety
cap fail closed. Stable identical duplicates are deduplicated. This verifies
accessible source traversal, not complete Lithuanian infrastructure coverage.
Two consistently incomplete provider publications cannot be detected locally.

Requests time out after 30 seconds and retry at most three times, with bounded
backoff. Database writes are never blindly retried. Every handled failed poll
has FAILURE plus UNKNOWN/PARTIAL completeness and paging evidence. An abrupt
process/connection interruption leaves RUNNING; inspect it before another run.
An uncertain commit must be checked by poll ID, never assumed failed.

A session advisory lock serializes collectors using this implementation for
the source, including fetch time. One transaction publishes locations, EVSEs,
connectors, real transitions and COMPLETE success. Original statuses and source
timestamp strings are preserved; offset-free dates are never assigned a zone.
Unchanged observations advance last-seen time. First observations create baselines;
transitions retain last previous observation and first new observation. Missing
stations/EVSEs/connectors are retained. Public EVSE IDs are display references;
canonical identities determine upserts. Independently usable capacity counts EVSEs.

## Real PostgreSQL integration tests

Provision a disposable local database **growev_collector_test** with PostGIS.
Create Supabase-compatible `anon`, `authenticated`, `service_role` roles;
apply the unchanged foundation migration. Add the corresponding migration-history
row in `supabase_migrations.schema_migrations`. Set `GROW_EV_TEST_DATABASE_URL`
in an ignored local env file to a local administrative connection. The test
guards loopback host and exact database name before truncating fixture tables.

```powershell
node --env-file=.scratch/test.env --test scripts/*.test.mjs
```

Without that variable, PostgreSQL integration tests are explicitly **skipped**;
parser/fetch tests still run. The integration suite tests actual upserts, timestamps,
duplicate public IDs, transitions, rollback, backend termination and serialization.
