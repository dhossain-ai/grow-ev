# TASK-012 — Automatic Charging Observations

Status: Workflow prepared; blocked on missing GitHub collector secrets and local TLS verification failure. GitHub database preflight, approved manual poll and schedule acceptance remain incomplete.
Date: 2026-10-10

## Scope and authorization

Existing collector and application unchanged; no migrations, routing calls,
RLS changes or DEV writes. After successful GitHub read-only preflight, request
approval for exactly one manual collector dispatch. Recurring writes require
separate cadence approval. TASK-006 one-poll approval was already consumed.

## Workflow audit

- Ubuntu; Node 22 (22.18+ required); ingestion working directory, matching lockfile
  cache path, clean `npm ci`, existing `npm run collect` entry point.
- Fixed missing `GROW_EV_PROJECT_REF` with audited DEV `heafsrqaytsfthfcxmqu`.
- Manual input defaults to `preflight`; only `collect` invokes the writer.
  No push trigger. Proposed schedule remains commented out.
- Ten-minute timeout, contents-read permission and noncancelling concurrency
  retained. Existing source session advisory lock also serializes across hosts.
- Both secrets required; CA reconstructed with 0600 permissions and `always()`
  cleanup. No database secrets passed to dependency installation.
- New `npm run preflight`: fixed DEV target and direct/session-pooler port 5432,
  verified certificate/hostname and `pg_stat_ssl`, schema/RLS/client table denial,
  health, recent/latest successful polls, entity counts, observation chronology,
  canonical duplicates and invalid transitions. SQL uses a READ ONLY / REPEATABLE
  READ transaction and rollback. RUNNING polls and invalid data block the writer.
- Sanitized failure categories; no raw database errors. Failed preflight prevents
  collection. Abrupt cancellation/timeout may leave RUNNING; inspect by poll ID
  before any further execution. GitHub failure does not prove commit failure.

## External evidence — 2026-10-10

GitHub secret-name listing contains Cloudflare/public Supabase secrets only.
`GROW_EV_DATABASE_URL` and `GROW_EV_DATABASE_CA` are missing. User instructed to
add existing DEV connection and full root certificate privately in repository
Settings → Secrets and variables → Actions. No remote secret values inspected.

Local `npm run preflight` failed **TLS verification**, exited nonzero and ran no
collector. Schema query and DEV baseline were not reached. No verification bypass
applied. GitHub database connectivity/TLS/health remain unverified until secrets
exist. No manual poll or recurring writes executed in this task.

Cloudflare deployment confirmed by successful GitHub run
[38050786913](https://github.com/dhossain-ai/grow-ev/actions/runs/38050786913),
SHA `ff2e2d696cb98bcfecee4f23f5e04a58d041661a`. Public browser checked around
15:20 Europe/Vilnius at [Grow EV](https://grow-ev-demo.dhossain.workers.dev/):

- Driver map renders and states “Current availability isn’t verified.”
- Network: 379/379 CCS2 observations stale; 140 locations; dated totals 334
  AVAILABLE, 12 CHARGING, 0 UNKNOWN, 33 other unavailable; zero fresh pairs.
- Switching to Type 2 gives 1,434/1,434 stale EVSE observations.
- Observed 03:46:01–03:46:04 Europe/Vilnius, fetched 15:19:44; explicitly says
  fetching does not renew source observations. Historical pairs labeled as dated.
- Code inspection confirms sixty-minute per-EVSE freshness and canonical distinct
  EVSE capacity. UNKNOWN is separate and cannot supply AVAILABLE capacity.
  Fresh AVAILABLE is provider evidence, not a physical arrival guarantee.
- Provider update age is **not exposed** in public RPC/UI. Offset-free provider
  timestamps remain unparsed in ingestion. A recent observation cannot establish
  recent provider publication. Acceptance limitation recorded; app changes excluded.
- Updated observations/public fresh-state behavior remain unverified without a
  new poll. These browser checks prove stale behavior only. No TomTom calls made.

## Schedule assessment — not approved or activated

`14,44 * * * *`: twice/hour UTC, 48 runs/day, 1,440 per 30 days. Normal spacing
fits the existing sixty-minute freshness gate, but scheduled jobs can be delayed
or skipped. Do not claim guaranteed freshness.

[Via Lietuva official open-data documentation](https://ev.vialietuva.lt/atviri-duomenys-1)
publishes OCPI and attribution/license requirements but no numeric polling quota.
Provider cadence restrictions remain unconfirmed. Source traversal is bounded and
compares independent identity sets; consistent upstream omissions and status
freshness cannot be established by traversal success alone.

Repository is private; actual owner's Actions plan, remaining allowance and usage
are unverified. Standard Linux executions are billed with minute rounding: at
least 1,440 minutes/30 days at one minute/run, plus longer runs and other workflows.
Actual poll duration must be measured from the approved GitHub execution; ten
minutes is a timeout, not measured runtime. Collector uses one session and workflow
concurrency, but actual DEV connection headroom/provider reliability are unverified.

Sources checked 2026-10-10:
[GitHub schedule semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule),
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Operational runbook

1. Add GitHub secrets privately; preserve CA verification and port 5432.
2. After workflow publication, dispatch **preflight** only and inspect JSON:
   project, TLS, health, latestSuccess, polls, counts and observation timestamps.
3. Before one-poll approval, retain an immutable private ignored read-only baseline
   of canonical identities/UUIDs, first/last observations and normalized/raw EVSE
   statuses. Counts alone cannot prove preserved identities or false nontransitions.
4. Obtain explicit approval, then dispatch **collect** once. Never blindly rerun
   a failed/cancelled writer or replay old captures as current measurements.
5. Compare actual retrieved/stored identities/counts, chronology and real status
   transitions to baseline; reconcile genuine source additions/moves. Confirm
   SUCCESS/COMPLETE, no canonical duplicates/false transitions and retained missing
   records. Prior full counts were 1,984 locations, 5,836 EVSEs, 5,838 connectors;
   these are historical evidence, not a newly verified baseline.
6. Reload public driver/dashboard; verify actual refreshed freshness without routes.
7. Verify poll duration, provider restrictions, Actions allowance and DB headroom;
   request separate cadence approval before uncommenting the schedule.

Inspect GitHub via Actions → Collect Chargers or:

```sh
gh run list --repo dhossain-ai/grow-ev --workflow collect-chargers.yml
gh run view RUN_ID --repo dhossain-ai/grow-ev
```

Read-only operational SQL (timestamps UTC unless explicitly converted):

```sql
BEGIN READ ONLY;
SELECT id, started_at, completed_at, outcome, completeness,
       extract(epoch FROM completed_at-started_at) AS duration_seconds,
       records_retrieved AS locations, pages_retrieved,
       pagination_metadata->'counts' AS fetched_counts,
       pagination_metadata->'transitions' AS transitions
FROM source_poll_runs WHERE source='via-lietuva-ocpi'
ORDER BY started_at DESC LIMIT 20;

SELECT id, completed_at FROM source_poll_runs
WHERE source='via-lietuva-ocpi' AND outcome='SUCCESS'
ORDER BY completed_at DESC LIMIT 1;

SELECT id, started_at, completed_at, outcome, completeness
FROM source_poll_runs WHERE source='via-lietuva-ocpi'
AND (outcome <> 'SUCCESS' OR completeness <> 'COMPLETE')
ORDER BY started_at DESC LIMIT 20;

SELECT min(last_observed_at) AS oldest, max(last_observed_at) AS latest,
       count(*) FILTER (WHERE last_observed_at >= now()-interval '60 minutes'
                         AND last_observed_at <= now()) AS fresh_evses,
       count(*) FILTER (WHERE source_last_updated_at IS NULL) AS unknown_source_age
FROM charging_evses WHERE source='via-lietuva-ocpi';
ROLLBACK;
```

`records_retrieved` is validated locations. Successful poll metadata stores actual
EVSE/connector/transition counts. Current tables also retain omitted identities.
Inspect unfinished/uncertain runs by ID before another collector execution.

## Validation

- Windows `npm ci`: passed; 19 audited packages, zero reported vulnerabilities.
- `npm run typecheck`: passed.
- `npm test`: 15 passed, no failures; PostgreSQL suite skipped by default.
- `node --env-file=.scratch/test.env --test scripts/ocpi-store.test.mjs`: all ten
  passed on guarded loopback `growev_collector_test`. Real PostgreSQL rollback,
  unchanged/genuine transitions, omitted records and serialization exercised.
- actionlint 1.7.7: passed corrected workflow; shellcheck/pyflakes unavailable,
  disabled. Initial invalid runner context in job env was corrected.
- Local DEV preflight: failed TLS; no baseline or writer executed.
- Isolated WSL Linux Node 22.22.0 / npm 10.9.4: clean install, TypeScript and
  15 tests passed; PostgreSQL suite skipped without server credentials. Missing
  configuration preflight correctly failed closed. No environment secrets copied.
- Security scan: 183 tracked/new source and exported web files, zero sensitive
  credential/certificate findings. `git diff --check` passed.
- GitHub DB preflight/manual poll/fresh-state UI/schedule: unrun, approvals pending.

Stop for review. TASK-012 is not complete.
