# TASK-012 — Automatic Charging Observations

Status: Recurring hackathon collection approved; activation changes validated, awaiting main publication and first actual scheduled execution. Earlier evidence below is chronological and superseded by the current authorization section.
Date: 2026-10-10

## Scope and authorization

User now explicitly approves recurring DEV collection at `14,44 * * * *` UTC
for the hackathon demonstration, expiring 2026-10-11 10:00 Europe/Vilnius.
This supersedes the earlier one-write-only gate. Manual dispatch remains supported;
its availability does not itself authorize new manual writes after the demo.
No migrations, model training, prediction writes, driver, routing or recommendation
changes are authorized. TASK-013 is a read-only audit and concrete proposal only.

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
  verified certificate/hostname on the actual Node client TLS socket, schema/RLS/client table denial,
  health, recent/latest successful polls, entity counts, observation chronology,
  canonical duplicates and invalid transitions. SQL uses a READ ONLY / REPEATABLE
  READ transaction and rollback. RUNNING polls and invalid data block the writer.
- Sanitized failure categories; no raw database errors. Failed preflight prevents
  collection. Abrupt cancellation/timeout may leave RUNNING; inspect by poll ID
  before any further execution. GitHub failure does not prove commit failure.

## External evidence — 2026-10-10

Initial GitHub secret-name listing lacked the two collector secrets. User added
`GROW_EV_DATABASE_URL` and `GROW_EV_DATABASE_CA` privately; both names were verified
on continuation. No remote secret values inspected.

Local `npm run preflight` failed **TLS verification**, exited nonzero and ran no
collector. Schema query and DEV baseline were not reached. No verification bypass
applied. GitHub database connectivity/TLS/health remain unverified because the
subsequent GitHub preflight failed configuration validation. No manual poll or
recurring writes executed in this task.

### Authorized read-only GitHub preflight — 15:53–15:54 Europe/Vilnius

- User explicitly authorized preflight only; collector and scheduling forbidden.
- Dispatched once on main SHA `27dd98c35a16f45835afee803d02c53e4cf708b0`,
  `mode=preflight`: [run 38053657215](https://github.com/dhossain-ai/grow-ev/actions/runs/38053657215).
- Checkout, Node setup, clean installation and certificate reconstruction passed.
- Preflight exited 1 with sanitized **CONFIGURATION**, before database connection.
  This is not an authentication, networking or TLS-verification result.
- Collector step skipped; `always()` certificate cleanup passed. No retry,
  collector execution, source fetch, schedule activation or DEV writes.
- TLS, database health, entity counts and latest successful observation query
  remain unrun in GitHub. Job duration ten seconds is not collection duration.
- Privately check that URL is a bare `postgresql://`/`postgres://` URI, without
  surrounding quotes, whitespace or nested variable assignment; database path
  `/postgres`; port 5432 (or omitted), not transaction pooler 6543; correct DEV
  direct hostname `db.heafsrqaytsfthfcxmqu.supabase.co` with user `postgres`, or
  a `.pooler.supabase.com` host with user `postgres.heafsrqaytsfthfcxmqu`.
  URL must contain no `ssl` query parameter; TLS verification is explicit in code.
  Keep password URL-encoded. These are required guard conditions, not claims
  about which private value failed. Do not share the connection string in chat.

### Read-only reruns and exact-rule diagnosis — 15:59–16:05 Europe/Vilnius

- User reported removing surrounding URL quotes, authorized another read-only
  preflight and requested the exact validation rule if configuration still failed.
- Main [run 38053970486](https://github.com/dhossain-ai/grow-ev/actions/runs/38053970486)
  at SHA `27dd98c` failed CONFIGURATION before connecting.
- Added fixed, typed configuration error labels in isolated branch
  `task-012-preflight-diagnostics`; main application/workflow unchanged.
  Error labels contain no connection-string components, credentials or raw errors.
- Diagnostic [run 38054127609](https://github.com/dhossain-ai/grow-ev/actions/runs/38054127609)
  at SHA `1ec73b3bd490bbf01e5f57ad4fa4d08786e8660f` failed
  **CONFIGURATION (URL_PARSE)**: `new URL(...)` rejected the private secret value.
  No more specific malformed component can be established from this safe label.
- Both runs used `mode=preflight`. Dependency installation and certificate
  reconstruction passed; collector skipped; certificate cleanup passed.
  DEV target validation, TLS handshake, database health and observations were not
  reached. Strict `rejectUnauthorized: true` retained. No DB writes or schedule.
- Diagnostic TypeScript passed; 16 tests passed, zero failures, one disposable
  PostgreSQL suite skipped. A path-mutating test fixture initially changed username
  instead of database path; corrected and full checks passed before dispatch.
  Diagnostic changes remain on the separate branch, not merged into main.
- Re-enter a complete valid bare URI privately. Check for accidental extra text
  and properly encode reserved characters in the password; no secret value was
  retrieved or printed. Stop until the private configuration is corrected.

### Preflight after private URI correction — 16:04–16:05 Europe/Vilnius

- User replaced the URL secret with their validated local PostgreSQL URI and
  authorized read-only checks: parse, DEV project, TLS, connectivity and latest
  successful poll. Dispatched preflight only from diagnostic SHA `1ec73b3`.
- [Run 38054365520](https://github.com/dhossain-ai/grow-ev/actions/runs/38054365520)
  passed secret reconstruction and URL parsing, then failed **TLS** before any
  SQL health/poll query. Therefore the DEV project host/username guard passed;
  successful TLS handshake, database authentication/connectivity and latest poll
  are unverified. No finer TLS detail is logged, and none is inferred.
- Collector was skipped; certificate cleanup passed. No writer, source poll,
  database transaction/write, scheduling change or secret output occurred.
- Strict `rejectUnauthorized: true` and the configured CA stayed enabled; no
  bypass or automatic retry. Investigate the private CA content/certificate chain
  in GitHub Secrets against the correct DEV root CA. Never send it in chat.

### Credential-free CA/TLS diagnosis — 16:12–16:13 Europe/Vilnius

- User authorized TLS debugging and allowed a database preflight only if resolved.
- Inspected the user-provided local `prod-ca-2021.crt` without printing PEM:
  one CA certificate, LF line endings, one final newline. Its exact file SHA-256 is
  `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`; its X.509
  SHA-256 fingerprint is
  `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
- Added temporary, credential-free strict TLS diagnostics on the isolated
  `task-012-preflight-diagnostics` branch. Reconstructs CA with `printf '%s'`
  byte-preservation; compares its raw SHA-256 and X.509 fingerprint; reports PEM
  shape/line endings; inspects node-postgres resolved host, port, negotiation, CA
  and `rejectUnauthorized`; checks SNI selection; then probes PostgreSQL SSLRequest
  and TLS without sending StartupMessage, username or password. Strict certificate
  and hostname checks remain enabled. Sanitized output prints no URL or CA text.
- Diagnostic run
  [38054892177](https://github.com/dhossain-ai/grow-ev/actions/runs/38054892177)
  isolated Node `ERR_OSSL_PEM_NO_START_LINE` before network connection.
- Diagnostic run
  [38054836411](https://github.com/dhossain-ai/grow-ev/actions/runs/38054836411)
  provides the structural evidence: reconstructed file 114 bytes; starts with
  expected PEM header=false; one certificate block=false; LF=0 / CRLF=0;
  text outside certificate=true; exact local file hash=false; X.509 fingerprint
  comparison=false because parsing failed. Its safe file SHA-256 is
  `c7a873d8f4a5bb7211f65462276c7d62e039b20d5c2a76d972951e820f1d26a0`.
- The root cause is that the GitHub CA secret currently reconstructs to content
  that is not the certificate PEM. It is not a bad TLS certificate: the local
  official certificate parses, and the remote bytes do not contain a PEM block.
  Evidence does not reveal what the secret text contains, so no more specific
  claim about how it was entered is made.
- URL parse and DEV host/project guard pass; pooler host shape and port 5432 pass.
  Node-postgres uses the parsed target as its host and would send it as SNI;
  negotiation is PostgreSQL SSLRequest. No SSL URI query parameters were present,
  the `ssl` override guard passed, and node-postgres receives the reconstructed
  CA with `rejectUnauthorized: true`.
- TLS chain, actual SNI certificate match, DB authentication/connectivity, TLS
  SQL status and latest poll remain unverified because PEM parsing stopped before
  network. No TLS handshake, database preflight, collector, source fetch, write or
  scheduling action ran in this diagnostic. Collector step skipped; cleanup passed.
- Correct the GitHub CA secret with the entire byte-preserved PEM from local
  `prod-ca-2021.crt`; secret entry must preserve its `BEGIN/END CERTIFICATE` lines
  and base64 body. Do not send the certificate in chat. Then rerun the diagnostic;
  only if strict chain/hostname validation succeeds may the same workflow proceed
  to its read-only database preflight.

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

## Original schedule assessment — before recurring approval

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
- The earlier malformed-PEM blocker was resolved by the user replacing the secret.
  GitHub preflight 38055352106 passed strict TLS, DEV connectivity and health.
  See the newer authorized collection evidence below; scheduling remains disabled.

## One authorized collection — 2026-10-10

- User approved exactly one existing collector execution against DEV
  `heafsrqaytsfthfcxmqu`. Verified session port 5432, strict CA/hostname TLS,
  unchanged ingestion code, workflow concurrency `collect-chargers` with
  `cancel-in-progress=false`, and source advisory lock before dispatch. No active
  Actions collector or unfinished poll existed. No schema changes.
- Dispatch [38055878539](https://github.com/dhossain-ai/grow-ev/actions/runs/38055878539)
  ran once at verified diagnostics SHA `091892978dfa267d3867d98e8deedb9f72f0d2d9`.
  TLS diagnostic, read-only preflight, collector and CA cleanup passed.
- Poll `f8ed5750-a7e0-45c4-96f0-79fc21055503`: SUCCESS/COMPLETE;
  13:29:15.108–13:31:32.677 UTC, 137.568781 seconds. Fetched and stored 1,984
  locations, 5,836 EVSEs, 5,838 connectors. Six page/probe responses, independent
  identity comparison verified, zero response duplicates. Advertised 3,273 remains
  diagnostic and does not represent validated location count.
- Private ignored immutable `.scratch/task012-approved-baseline.json` and
  `.scratch/task012-approved-after.json` hold full before/after rows. Read-only audit
  SHA-256 baseline `e504b80cf7aae2c996812ecccffee1b449a045d23e1ab98f1fee2e43eeb5494b`;
  after `05fe228a97d518f88bcdc859aeca2f69da7ee04348981e86b1a5c4f124a742da`.
  confirms exactly one new poll, retained all prior entity UUIDs/identities and
  first observations, zero canonical duplicates. All 5,836 EVSE observations
  advanced to 13:29:17.038–13:29:20.841 UTC. Exactly 1,001 normalized/raw changes
  matched exactly 1,001 transitions, including previous/new statuses and timestamps;
  unchanged states generated none. Total stored history transitions: 1,067.
- Read-only postflight passed schema/security and data checks: zero unfinished
  polls, invalid observation times, invalid transitions or canonical duplicates.
  No data deleted. No failed/partial publication occurred; no additional DEV failure
  experiment was run. Prior disposable rollback/retention tests and the verified
  no-delete implementation support failure behavior separately.
- Public browser network view ~16:32 Europe/Vilnius displayed 379 fresh CCS2
  observations: 288 AVAILABLE, 51 CHARGING, 4 UNKNOWN, 36 other; 16 fresh cross-operator
  pairs. Type 2 displayed 1,434 fresh observations and 54 fresh pairs. UI observation
  range 16:29:17–16:29:20, with fetch time separate. UNKNOWN remains separate.
- No collector error reported. Provider publication age is still unknown: all
  5,836 parsed source-update times null. No models, schedule or unrelated deployment.
  The one-run approval is consumed; stop before any additional database writes.

## Approved schedule activation — 2026-10-10

- Cron `14,44 * * * *` UTC; concurrency `collect-chargers`, noncancelling,
  ten-minute job timeout, DEV ref and default read-only dispatch preserved.
- Expiration is `2026-10-11T07:00:00Z` (10:00 Europe/Vilnius, UTC+03:00).
  Checked after checkout and before Node/dependency setup, and again immediately
  before dependency installation, read-only DB preflight and collector invocation.
  Equality/delayed starts fail closed. No dependency installation, source polling
  or DB access starts after cutoff. A poll already started finishes transactionally.
  Manual workflow_dispatch bypasses the schedule cutoff and retains both modes.
- Carry forward the already successful diagnostics branch's preflight and tests;
  strict actual client TLS socket/CA/hostname verification replaces the incorrect
  Supavisor backend-hop test. Temporary TLS diagnostic tool is not promoted.
  Certificate reconstruction preserves bytes; collector implementation unchanged.
- Official [source documentation](https://ev.vialietuva.lt/atviri-duomenys-1),
  rechecked today, permits unlimited use/sharing with attribution and license links.
  No numeric request frequency limit is published. Therefore the demo cadence has
  no published conflict, but explicit provider approval of a polling quota cannot
  be claimed. Existing bounded retries and failure handling remain authoritative.
- Private repo and successful run confirmed through GitHub API. Runner job was
  152 seconds (155 seconds whole run); budget approximately 3 rounded minutes/poll.
  From first intended slot 14:14 UTC today through 06:44 UTC tomorrow: 34 slots,
  approximately 102 minutes if this duration repeats, conservative 340 minutes at
  timeout (runner teardown can add overhead). These are estimates, not charges.
  Monthly perpetual polling would use about 4,320 minutes at this duration.
- GitHub billing API returned 404/missing `user` scope; actual owner plan,
  remaining included allowance and hard spending cap are **unverified**. Timing
  API `billable.total_ms=0` does not establish free execution. Official current
  standard Linux 2-core rate is $0.006/min beyond allowance: approximately $0.612
  for 102 minutes or $2.04 for 340 minutes if all are overage. Other workflows count.
  [Billing reference](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- Expired runs still allocate one brief checkout/check job, potentially one rounded
  minute each (48/day). Remove only the cron after the demo to eliminate this cost;
  retain manual support. This safeguard bounds expensive work, not account spend.
- Local ingestion TypeScript passed; 16 tests passed, zero failed, disposable DB
  suite skipped. Six cutoff tests passed, including equality, invalid clock,
  dispatch after cutoff and unsupported events. actionlint passed (shellcheck and
  pyflakes unavailable/disabled); diff whitespace check passed.
- Main publication and first scheduled-run evidence pending. No manual poll is
  dispatched as a substitute for a schedule. TASK-012 is not fully complete until
  actual schedule execution and fresh public observations are verified.

Stop for review before TASK-013 migrations or prediction writes.
