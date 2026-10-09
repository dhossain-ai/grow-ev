# TASK-004B — Grow EV Charging Data Collector

Status: Complete — verified on Supabase DEV
Priority: P0
Updated: 2026-10-10

## Scope and implementation

One-shot server-side TypeScript collector for official Via Lietuva OCPI locations.
Validated canonical location/EVSE/connector upserts, current original/normalized
statuses, polling evidence, and atomic observed transitions. No app, scheduling,
map markers, routing, tariffs, billing or ML changes. TASK-005 not started.

TASK-004A finalized first as `f2ea4d4` (`feat: add verified charging database
foundation`). Remote migration history matches all 31 repository SQL statements
after whitespace/comment normalization. No applied migration changed; no new
migration required. TASK-003 and TASK-004B finalized in Git.

## Verification performed

- Source dry-run/capture: 1,984 locations, 5,836 EVSEs, 5,838 connectors.
  Five explicit windows (including terminal empty offset 4000) and one independent
  large window agree on all canonical identities. Advertised count 3,273 is diagnostic.
- Full captured live snapshot ingested **locally** twice: exactly those stored
  counts after both runs, zero transitions and no duplicated entities.
- `npm --prefix services/ingestion run typecheck`: passed.
- `git diff --check` and per-file untracked diff checks: passed. Staging area empty.
- Ingestion dependency audit: zero vulnerabilities. Secret scan matched only the
  deliberate connection placeholder in `.env.example`, not a credential.
- `node --env-file=services/ingestion/.scratch/test.env --test services/ingestion/scripts/*.test.mjs`: **23 passed, 0 failed, 0 skipped**.
  Parser/pagination/network tests and real PostgreSQL integration suite passed.
  Covers identical ingestion, real status change with observation bounds/raw time,
  duplicate public IDs, omissions, stale observations, failed/partial polls,
  rollback after EVSE writes, hard connection interruption and source serialization.
- Local PostgreSQL 16.15 / PostGIS 3.4.2 installed in WSL. A separate empty
  foundation database applied the unchanged migration; original rollback-only SQL
  suite passed twice. Its first run in the populated collector test database failed
  an empty-database count assumption; separate empty-target reruns passed.
- Read-only DEV comparison: constraints, indexes, RLS and column types/defaults
  agree with the local foundation. Generated geography expression differs only in
  extension-schema qualification due to search_path; no meaningful schema mismatch.
- Linked ref `heafsrqaytsfthfcxmqu` confirmed by user as grow-ev-dev despite the
  dashboard's default project name. Both approved collector writes completed.

## Security and failure handling

Only server env credentials; TLS certificate verification. Client tables retain
default-deny RLS/ACL. Generated snapshots/env files ignored. Raw database errors
and connection strings withheld. Session source lock plus one publication
transaction; failures never publish COMPLETE success. Interrupted RUNNING rows
remain visible. No blind database retries or deletion on omissions. UNKNOWN never
means AVAILABLE; capacity counts EVSEs. Unrecognized original status changes are
retained, including UNKNOWN-to-UNKNOWN transitions.

## Supabase DEV verification — 2026-10-10

- Environment file exists, is Git-ignored and is not tracked or staged.
- Fixed a nested DATABASE_URL assignment privately. Direct IPv6 DNS lookup failed;
  changed only transport to the same project's cached session pooler (port 5432).
  Added the official Supabase CA with certificate/hostname verification retained.
  Collector accepts optional GROW_EV_DATABASE_CA_FILE from the local environment;
  plain npm run collect -- --check now passes without shell-specific TLS setup.
- Supabase CLI's currently authenticated account lists another project; DEV checks
  and ingestion used the supplied database credentials with exact project-ref,
  session-pooler identity and linked-ref guards. No other project was written.
- Read-only baseline: all five tables empty. Applied migration-history statements
  again match the repository. Schema/security preflight passed; no schema changes.
- First live ingestion: poll dcea556f-9796-41da-8764-69146f0844af.
  Fetched/stored: **1,984 locations / 5,836 EVSEs / 5,838 connectors**;
  **1 SUCCESS/COMPLETE poll / 0 transitions**.
- Exact artifact replay: poll fe99a329-3d21-44b8-90c3-7abd0b19ef49.
  Same entity counts; **2 SUCCESS/COMPLETE polls / 0 transitions** overall.
- Read-only full-row verification compared every parsed source field and scoped
  association against the database after each run. Canonical duplicate locations,
  EVSEs and connectors: **0 / 0 / 0**. Replay retained entity UUIDs, first-seen
  times and every non-observation field; last-seen advanced correctly.
- Each poll records 1,984 locations and six page requests (five source windows plus
  verification probe). Replay metadata matches the captured SHA-256. No RUNNING,
  FAILURE or incomplete poll; no partially published rows or false transitions.
- Source has **95 duplicated public EVSE-ID groups** and **30 UNKNOWN EVSEs**.
  Those public references remain nonunique; canonical identity is correct and
  UNKNOWN never becomes AVAILABLE.
- Relevant tests rerun: **23 passed / 0 failed / 0 skipped** on disposable local
  PostgreSQL. TypeScript and final read-only TLS/schema check passed after the CA
  configuration fix. Live database state was not altered to fabricate a transition.
- Ignored capture and read-only verification scripts/results remain in .scratch/.

## Review and commit organization

Preserve all 19 pending legitimate files. Commit TASK-003 investigation, findings,
fixture and task record first; then TASK-004B collector, tests, tooling, README,
environment example, ignore rule, task record and final STATUS update. Split the
shared investigation helper exports/main guard and TypeScript config changes so
collector-specific changes belong to TASK-004B; TASK-003's baseline config uses
existing driver type definitions. Use explicit staging allowlists and review the
index before each commit. Exclude .env.local, certificates and generated snapshots.
TASK-003 and TASK-004B finalized in Git.

## Limitations

COMPLETE describes validated accessible OCPI traversal, not national inventory.
Provider scope, timezone and freshness guarantees remain unresolved. Replay is
archival idempotency verification, not a new live source measurement. Scheduling,
app changes and TASK-005 remain outside scope. Stop for review.

Commands and setup: services/ingestion/README.md.
