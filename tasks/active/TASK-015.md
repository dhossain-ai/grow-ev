# TASK-015 — permanent collection and ML data pipeline

Status: LOCAL IMPLEMENTATION VERIFIED; STAGED ACTIVATION APPROVED, STOPPED AT SECRET CONFIGURATION GATE.
Primary success criterion is unmet: no automatic run of the new snapshot pipeline
has been activated or observed. No DEV migration, new collection, deployment,
secret configuration, recurring trigger or publication was performed in this task.

Worktrees: `E:\Grow EV-task015`, branch `task-015-permanent-pipeline`;
`E:\grow-ev-ai-task015`, branch `task-015-history-inference`. Original repositories
and their pending work are preserved. Reviewed changes are approved for isolated commits.

## 1. Current scheduler audit

The prior zero-scheduled-run finding is superseded by actual GitHub evidence.
[Scheduled run 38076185317](https://github.com/dhossain-ai/grow-ev/actions/runs/38076185317)
was created 2026-10-10 18:32:23 UTC / 21:32:23 Europe/Vilnius at SHA `226c7a0`.
Its runner job lasted 64 seconds and finished successfully at 18:33:29 UTC.
Logs identify poll `373f0ec2-8520-4650-939b-d05c914ea1d7`, 1,984 fetched locations,
5,834 fetched EVSEs, 5,836 fetched connectors and 243 genuine transitions.
Retained totals remain 1,984 / 5,836 / 5,838.

Strict-TLS, REPEATABLE READ / READ ONLY audit at 19:27:40.793 UTC confirmed that
poll as SUCCESS/COMPLETE, five genuine successful polls plus one replay, 2,321
transitions, no snapshot/prediction tables, and 29,423,283 database bytes.
Private immutable audit capture is in the AI worktree `.private/task015-readonly.json`;
sanitized evidence is `reports/task015_verified_audit.json` there.
The unchanged production workflow is active with `14,44 * * * *` and the exact
2026-10-11 07:00 UTC cutoff. Manual runs have succeeded too.

Why earlier slots were absent remains unverified. GitHub exposes neither their
delivery cause nor a guarantee of cron timeliness. Its documentation allows
[delayed or dropped scheduled jobs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
There is one observed scheduled success; this does not establish ongoing reliability.

## 2. Dedicated scheduler

`services/collector-trigger` targets only `grow-ev-collector-trigger`.
Wrangler configuration has no cron and `ENABLED=false`. No Voice AI files changed.
One SQLite Durable Object serializes checks, reserves the UTC half-hour slot
durably before dispatch and retains the attempt outcome. It checks GitHub for
active/queued runs first. Unknown network outcomes and HTTP rejections do not
cause a same-slot retry; a later slot checks GitHub again. Existing Actions
concurrency and the collector's source advisory lock remain the final concurrency
guards. Delayed invocations beyond ten minutes are rejected, without catching up.

The Worker dispatches the existing collector in `permanent` mode. The workflow
fails unless permanent collection, history and Cloudflare scheduler variables
are explicitly configured. Setting `GROW_EV_SCHEDULER=cloudflare` disables the
old GitHub scheduled collection path even before its cron stanza is removed.
Legacy schedule cutoff remains intact; the reviewed permanent dispatch path
continues beyond it. No production cutoff was removed in this task.

Protected GET `/health` reports latest successful permanent run, age, failure
and a missed-success flag after 75 minutes. Evidence is GitHub job success,
which requires the DB receipt and durable archive verification, rather than a
direct Worker database query. No public dispatch route or DB secret exists.
Errors fail cron invocations and emit sanitized dispatch IDs/statuses. Health
is pull-based; an external alert consumer is not configured.

## 3. Historical storage and measured growth

`20261010004000_charging_poll_snapshots.sql` adds one private table and an
invoker trigger validating verified SUCCESS/COMPLETE, nonreplay provenance,
zero duplicates, exact counts, ordered timestamps and immutable updates.
One row per poll stores source/schema/counts/observation bounds, gzip JSON and
compressed-byte SHA-256. Payload has exact fetched canonical station/EVSE/connector
membership, raw/normalized EVSE status, first/last observation times, connector
standards/power and current poll plus immediate genuine predecessor metadata.

Python reconstructs distinct EVSE capacity, AVAILABLE, CHARGING/BLOCKED/RESERVED
occupied counts, UNKNOWN and other unavailable partitions by station/standard.
Several connectors on one EVSE never multiply its capacity. Occupancy does not
prove post-charge idling. Source completeness describes the accessible feed scope.

Insertion is in the existing state/transition/poll-success transaction. Failure
rolls it all back. Replays create no historical snapshot. Existing completed
polls cannot be rewritten. No past snapshots are fabricated or backfilled.
RLS is default deny; anon/authenticated have no privileges. Service role gets
SELECT/INSERT only, with no UPDATE/DELETE. Reviewed pruning requires owner
credentials already used by the existing private collector.

Offline format sizing of the read-only audit, using the exact production encoder:

| Measurement | Bytes |
| --- | ---: |
| JSON, current poll plus predecessor | 3,486,347 |
| gzip per poll | 535,665 |
| Three days, 48 polls/day, compressed payload only | 77,135,760 |
| Seven days, payload only | 179,983,440 |
| Thirty days of private archive | 771,357,600 |

These measure encoding of a retained audit, not creation of a past observation.
PostgreSQL index/TOAST/page overhead is additional and has not been measured at
full feed scale. The disposable database proves actual storage and transaction
behavior on fixtures, not full-scale disk growth.

Proposed hot retention is three days. Private bucket `grow-ev-poll-history`,
prefix `v1/`, stores immutable time/poll/checksum `.json.gz` objects.
Every uploaded or preexisting object is downloaded and SHA-256 checked.
Compact pruning is disabled unless `GROW_EV_HISTORY_PRUNE=approved`; even then
only snapshots older than three days with verified durable copies are removed.
Poll registry, retained entities, transitions and archive objects are never deleted.
There is no automatic archive deletion. Monthly secondary offline durable export
and independently verified retention review are necessary for indefinite operation.

Caps fail closed: 128 MiB snapshot relation, 400 MiB database, 800 MiB archive
bucket, 8 MiB per compressed object, 10,000 listed objects and 336 archival rows
per run. Snapshot checks happen under the source lock before source requests.
Storage failure retains unverified DB snapshots. An archive-cap failure can
follow a committed collection; subsequent history/database caps eventually
stop polling, making maintenance explicit rather than silently losing history.

## 4. Membership mismatch

AI aggregation prefers the checksum-verified per-poll payload. For pre-migration
polls, it selects source stations/EVSEs observed inside the latest verified poll's
interval and demands exact source counts, unique canonical identities, matching
scope and valid chronology. Connectors of those current EVSEs are a retained
superset of fetched connectors: exact connector cardinality equality certifies
that none of that superset is omitted. If equality fails, inference fails closed
instead of using uncertain topology. Omitted EVSEs and their connector rows
remain retained and keep their earlier timestamps.

Actual audited mismatch now reconstructs 2,445 groups from 5,834 current EVSEs
while retaining all 5,836 inventory EVSEs. Regression tests cover omissions,
uncertain connectors, duplicate entities, stale/future chronology and snapshot
supersession. Historical archive decoding requires exact payload counts too.

## 5. CatBoost and MLP readiness

Existing `availability_v1.cbm` and `availability_mlp_v1.joblib` are unchanged.
The collector can dispatch the existing AI workflow only after verified history
and durable archive success. This chain is gated off and requests dry-run only,
with the exact source poll UUID. The AI job rejects a superseded/missing/failed/
partial/replayed poll, invalid identity or uncertain membership. Extraction
omits the growing transition ledger and reads only the latest poll for inference.
Existing idempotent publication and collector/publication locks are preserved;
source verification is checked again immediately before publication.

One-hour expiry derives from the oldest compatible observation. Equality at
one hour is expired. No inference run can extend expiry. At the actual read-only
audit clock, the existing CatBoost inferred 2,445 eligible records; this is dated
clock replay proof. A later actual dry-run inferred the same dated feature rows
but withheld all 2,445 as stale and produced zero publishable records. No model
training or prediction writes occurred against live data. MLP runs only as a
shadow on the same validated current snapshot, with no publication path.

Publication remains manual through the existing protected environment; automatic
chaining does not publish. No driver integration or deployment is part of this task.

## 6. Historical export and retraining

The existing dataset preparer accepts checksum-named private gzip archives.
`src.download_history` validates a bounded 1–31-day UTC window, lists private
objects with explicit offsets, rejects redirects and validates checksum, schema,
poll identity/time and membership before writing private files. Current plus
immediate predecessor metadata prevents absent archives from being silently
bridged as consecutive observations.

Manual-only `.github/workflows/retrain.yml` runs existing CatBoost and MLP
training and paired persistence comparison. It preserves actual gaps, excludes
indeterminate UNKNOWN targets and changed topology, and uses existing chronological
evaluation when enough independent eligible periods exist. Candidate models,
dataset/source/code hashes, dependency versions and reports are exported under
immutable run/attempt artifact names. Existing paths cannot be overwritten.
No candidate is automatically promoted. Proper out-of-time near-30-minute
evaluation remains unavailable; neither a forecast accuracy nor calibration is claimed.

## 7. Quotas and service cost

Recent observed collector job: 64 seconds (two rounded runner minutes).
Existing successful CatBoost job 38065815976: 41 seconds (one rounded minute).
Thirty-minute collection plus inference thus estimates at least 4,320 minutes
per 30 days, before archive, expanded tests/shadow, other jobs and setup delays.
The earlier repository audit recorded GitHub Pro / 3,000 included minutes and
$0 stop-usage budget. That account billing snapshot is older and was not refreshed:
the current billing API returned 404; no account quota change was made.

**Recommend an hourly activation first**, estimated at least 2,160 minutes/month
under those observed durations, then measure the entire new pipeline. This is
an estimate, not proof that the remaining allowance covers it. Thirty-minute
cadence is technically prepared but cannot be represented as indefinitely free.
Keep the existing $0 stop budget; do not add a paid service or raise spending.
Recheck signed-in current usage and choose the final cadence in the single approval.
[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
documents per-job minute rounding and included private-repository allowances.

[Cloudflare SQLite Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/)
support Workers Free. One dispatch object and 24–48 cron calls/day are well
below published request/storage allowances in isolation; actual aggregate
account use and runtime CPU/latency remain unverified.
[Supabase Free](https://supabase.com/pricing) lists 500 MB database and 1 GB file
storage. Current database size is verified above; the actual account plan,
existing file-storage consumption and other shared usage still need signed-in
verification before activation. Thirty-day archives are about 736 MiB at the
sample size and 30-minute cadence, so they require capacity/retention review.
Archival POST+GET payload traffic is approximately 1.44 GiB/month at that cadence,
plus training downloads and object listings. No paid bucket/service was created.
[Via Lietuva open data](https://ev.vialietuva.lt/atviri-duomenys-1) permits reuse
with attribution but supplies no numeric polling quota; provider cadence
approval cannot be inferred from licensing. Existing bounded source retries remain.

## 8. Exact migrations proposed

Only these two new DEV migrations are proposed, in order:

1. `supabase/migrations/20261010003000_charging_predictions.sql`: exact unchanged
   copy of the previously prepared AI migration, private predictions plus bounded
   read RPC. This copy does not authorize applying it or publishing.
2. `supabase/migrations/20261010004000_charging_poll_snapshots.sql`: private
   compressed snapshots and insert/update validation trigger described above.

Existing applied migration files are unchanged. A private Storage bucket is a
separate reviewed configuration action, not an unreviewed schema migration.
Set bucket public=false, file limit 8 MiB, allowed MIME application/gzip. Audit
existing storage policies for accidental wildcard public access before upload.

## 9. Secrets and configuration required

| Target | Name | Purpose |
| --- | --- | --- |
| Cloudflare collector Worker | `GITHUB_TOKEN` | Fine-grained token, ONLY grow-ev repository, Actions read/write; encrypted secret |
| Cloudflare collector Worker | `STATUS_TOKEN` | Independent protected health bearer secret |
| Main GitHub repository | existing `GROW_EV_DATABASE_URL`, `GROW_EV_DATABASE_CA` | Strict-TLS DEV collector access |
| Main GitHub repository | `GROW_EV_ARCHIVE_SERVICE_KEY` | Private Supabase Storage API access, never sent to Cloudflare/frontend |
| Main GitHub repository | `GROW_EV_AI_DISPATCH_TOKEN` | Separate fine-grained token, ONLY grow-ev-ai, Actions read/write |
| AI GitHub repository | existing `GROW_EV_DATABASE_URL`, `GROW_EV_DATABASE_CA` | Strict-TLS DEV read-only extraction |
| AI protected archived-training environment | `GROW_EV_ARCHIVE_READ_TOKEN` | Private archive read access; use restricted storage principal where available |

Main repository variables: `GROW_EV_SCHEDULER=cloudflare`,
`GROW_EV_PERMANENT_COLLECTION=approved`, `GROW_EV_HISTORY_ENABLED=approved`,
`GROW_EV_INFERENCE_CHAIN=approved`; leave `GROW_EV_HISTORY_PRUNE` unset until
the first genuine remote automatic archive is downloaded and checksum-verified.
Only then set `GROW_EV_HISTORY_PRUNE=approved`. Protected AI publication
environment retains required reviewers and `GROW_EV_ALLOW_PUBLISH=approved`
only if publication is explicitly included in the approval. No tokens were read
from global Git credential files, copied into code or configured by this task.

## 10. Approved staged activation procedure — REMOTE ACTIVATION NOT EXECUTED

The user approved staged activation on 2026-10-10. Initial cadence is hourly;
automatic publication, model promotion and driver/Voice deployment remain prohibited.
Stop at any unverifiable billing, permission, migration or secret boundary.

1. Confirm exact DEV ref `heafsrqaytsfthfcxmqu`, current remote migration ledger,
   both reviewed branch SHAs and current account quota/storage. Dry-run migration
   push must show only the two migrations above; stop on unexpected pending work.
2. Merge only reviewed files in both repositories. Main pushes can trigger the
   unrelated web deploy workflow, so use an authorized `[skip ci]` integration
   commit and verify no driver/Voice deployment was started. No push was made here.
3. Apply the two reviewed DEV migrations; run remote security/ACL/column checks.
   Create/audit the private archive bucket and configure server-side secrets,
   protected environments and the approved retention policy/cadence.
4. Deploy ONLY the dedicated collector Worker with no cron and ENABLED=false.
   Confirm protected health and real GitHub permissions without dispatching a poll.
5. Set `GROW_EV_SCHEDULER=cloudflare`; verify the old GitHub scheduler refuses
   collection, and wait for any active collector to finish. Remove the old cron
   stanza only within this approved integration. Keep manual preflight and the
   historical cutoff guard; permanent mode bypasses the hackathon-only window.
6. Enable history, permanent collection and dry-run AI chaining. Keep pruning off.
   Set the dedicated Worker ENABLED=approved and activate exactly one cron:
   `14 * * * *` hourly. Thirty-minute cadence is not approved.
   Never have both scheduler paths collecting simultaneously.
7. Let the first real Cron Trigger initiate collection. Do not substitute a
   manual poll or repeatedly dispatch for proof. Verify the chain described below.
8. After first genuine automatic remote archive verification, enable three-day
   compact pruning. Each deletion still requires authenticated download/checksum
   proof for that exact archived poll. CatBoost stays dry-run and MLP shadow-only.

Rollback: disable Worker ENABLED first, remove its cron, leave manual preflight
available and inspect failed/ambiguous runs. Retain all genuine evidence. Do not
drop tables, resend an uncertain dispatch or restore an overlapping scheduler.

## 11. Proof after the hackathon

Match Cloudflare `cf-<slot>` dispatch log to GitHub permanent run title/receipt,
then its exact poll UUID to DB SUCCESS/COMPLETE, verified counts and one snapshot.
Verify canonical fetched membership and timestamp bounds; download/decode/hash
the private archive; match AI dry-run source poll and current model checksums.
Verify no duplicate snapshot/forecast rows and no relabeled omitted records.
Check health age and actual durations, runner minutes, database/storage growth.

Observe at least three consecutive automatic slots and a genuine automatic slot
after 2026-10-11 07:00 UTC / 10:00 Europe/Vilnius. Export at least two consecutive
genuine archives into the existing dataset builder and inspect actual gaps and
UNKNOWN/topology exclusions. Recheck again after 24 hours and before three-day
retention first executes. Only then report operating recurring history capture;
long-term reliability and near-30-minute forecasting require longer evidence.

## 12. Executed validation and remaining limits

Passed: ingestion strict TypeScript and 24 non-DB tests; two default DB suites
are skipped without explicit local configuration. Dedicated disposable WSL
PostgreSQL suite passed seven checks, including actual migrations, atomicity,
immutability, membership, rollback and permissions. Existing prediction SQL
security/idempotency/expiry tests passed transactionally in that disposable DB.
The existing collector PostgreSQL regression suite also passed all ten checks
in a separate fresh disposable database with the new migrations installed.
Synthetic PostgreSQL/TypeScript gzip output was decoded by the real Python
archive loader and feature builder, proving the cross-repository format locally.
Cloudflare Worker strict TypeScript, five mocked tests and Wrangler 4.149.0
deployment dry-run passed; npm audit reports zero vulnerabilities there.
Ten collection-window tests and all main/AI workflow actionlint checks passed
(shellcheck/pyflakes disabled because unavailable). Existing driver 66 tests,
TypeScript and lint passed in the unchanged original app checkout.
AI pytest (42 tests) and compile checks cover membership, archives, both existing model
loads, real fixture candidate retraining/export, persistence and expiry.

Initial local checks found a missing TypeScript fetch-body conversion, a malformed
mock run title, a CRLF shell issue and PostgreSQL microsecond timestamp truncation
for empty polls. Each was corrected and relevant checks rerun. No remaining
known failing check; full final results are recorded in the AI task report.

Unrun: new remote migrations/bucket ACLs; real Cloudflare scheduled dispatch and
DO restart/runtime CPU; real archival/pruning and retraining Actions jobs;
publication; full-scale PostgreSQL disk measurement; current signed-in billing
and Storage usage; genuine automatic snapshot chain after cutoff. No new driver
build/browser/native validation is claimed because the application was unchanged.
Health does not send proactive notifications. Secondary durable archive rotation
and long-lived transition/poll-ledger retention are operational follow-ups;
the overall DB/storage caps stop further growth pending review. No new model,
calibration, 30-minute forecast, arrival availability or waiting-time claim.

## 13. Hourly archive capacity and future rotation

The implemented cap is **800 MiB (837,860,800 bytes)**, not an indefinite
retention policy. The observed projection is 535,665 compressed bytes per poll.
At 24 polls/day this is approximately 12,855,960 bytes/day: an initially empty
bucket reaches the cap in about **65 days**. Actual poll size and existing bucket
usage change that estimate; recompute `(cap - current bytes) / measured daily
growth` after the first automatic archive and after 24 hours. Thirty-minute
cadence would halve the horizon and is not approved.

Plan the first export within 30 days of activation and review monthly thereafter,
well before day 60. Export completed UTC ranges through the bounded private
archive downloader in batches of at most 31 days. Preserve every original gzip
and a manifest containing object path, poll UUID, source timestamps, byte count
and SHA-256. Store two independently durable copies on existing storage with
adequate verified capacity; do not introduce a paid service. Verify every copy
by reading it back, checking compressed hashes, decoding membership, checking
predecessor continuity and matching the manifest to the remote inventory.

Archive rotation is **not implemented or automatically authorized**. A future
review must approve an exact object deletion allowlist only after both durable
exports pass verification. Never remove an unexported or checksum-unverified
object, and never delete history merely to keep collection running. Record the
export locations, manifests and deletion audit without exposing credentials.
If export/rotation is unavailable, the cap fails closed and collection will
eventually stop at the hot-history/database caps; this needs operational attention.

## 14. Controlled activation preflight — 2026-10-10

Read-only DEV audit at 19:58:28 UTC: applied versions `20261009000100`,
`20261010001000`, `20261010002000`; exactly the two approved migrations pending.
Neither new table exists. Database size is 29,423,283 bytes. No Storage buckets,
objects or Storage object policies exist. No migrations or bucket writes performed.

Signed-in GitHub billing: GitHub Pro, 39/3,000 Actions minutes used,
2,961 minutes remaining; Actions storage 0/2 GB; $0 billable Actions usage.
The Actions account budget is $0 with Stop usage **Yes**; no budget was changed.
Hourly projected job minutes remain an estimate until the full chain runs.

Main repository secret-name inventory lacks `GROW_EV_ARCHIVE_SERVICE_KEY` and
`GROW_EV_AI_DISPATCH_TOKEN`. AI has no `archived-training` environment;
its private archive read credential is not configured.
Worker-specific `GITHUB_TOKEN` and `STATUS_TOKEN` configuration is unverified.
No credential value was requested, read from global credential files or printed.

Supabase organization dashboard confirms Free plan and no overage billing:
database summary 0.045/0.5 GB, current project detail 42.63 MB; file Storage
0/1 GB; uncached egress 0.108/5 GB; cached egress 0/5 GB. Dashboard measurements
may lag up to one hour and differ from the direct SQL database-size measurement.
These are separate observations, not interchangeable byte counts.

Stopped before remote writes because required narrowly scoped credentials are
absent/unverified. Both isolated branches can be committed without altering the
live app. No push to main, DEV migration, bucket creation, Worker deployment,
variable switch, manual poll, new automatic run, publication or pruning occurred.

### Manual configuration locations (values must never be sent in chat)

* Main repository: Settings > Secrets and variables > Actions > Repository secrets:
  `GROW_EV_ARCHIVE_SERVICE_KEY`, `GROW_EV_AI_DISPATCH_TOKEN`.
  https://github.com/dhossain-ai/grow-ev/settings/secrets/actions
* GitHub personal account: Settings > Developer settings > Personal access tokens
  > Fine-grained tokens. Create two separate expiring tokens: grow-ev only with
  Actions read/write for Worker `GITHUB_TOKEN`; grow-ev-ai only with Actions
  read/write for main `GROW_EV_AI_DISPATCH_TOKEN`. Metadata read is implicit.
  No Contents write, organization-wide access or Voice permissions are needed.
  https://github.com/settings/personal-access-tokens
* Supabase exact project: Project Settings > API Keys > Legacy anon, service_role
  API keys, server-only service_role credential for `GROW_EV_ARCHIVE_SERVICE_KEY`.
  Transfer directly into the GitHub secret form; never use a publishable key.
  https://supabase.com/dashboard/project/heafsrqaytsfthfcxmqu/settings/api-keys
* After the dedicated disabled Worker exists: Cloudflare > Workers & Pages >
  grow-ev-collector-trigger > Settings > Variables and Secrets. Encrypted secrets
  `GITHUB_TOKEN` and independent random `STATUS_TOKEN`. This Worker does not yet
  exist; do not configure these on grow-ev-voice.
* For later manual retraining: AI repository Settings > Environments >
  create archived-training > Environment secrets: `GROW_EV_ARCHIVE_READ_TOKEN`.
  Use private Storage read-only authorization, with required reviewers if available.
  https://github.com/dhossain-ai/grow-ev-ai/settings/environments

### Requested activation evidence A–J

A. Main and AI local commit SHAs: recorded in the handoff after allowlist commits.
B. Applied DEV migrations: neither approved migration applied; exact two pending.
C. Dedicated Worker: not deployed; config disabled, no Cron Trigger.
D. Actual new hourly Cron: none. Existing GitHub hackathon cron remains
   `14,44 * * * *` with its existing cutoff; no scheduler switchover was performed.
E. First new automatic pipeline run URL: none. Existing scheduled evidence in
   section 1 is not evidence for this new pipeline.
F. New database snapshot: none; snapshot table is absent.
G. Private archived gzip/checksum: none; no bucket or object created.
H. CatBoost new-chain dry-run: not run. Local 42-test ML suite passes; no
   automatic prediction write or model promotion was initiated.
I. Current usage: verified account/SQL observations above; $0 budget preserved.
J. Risks: missing secret configuration/expiry; unverified Worker account aggregate
   usage and runtime; actual Actions duration unknown; no remote archive/pruning
   proof; finite 65-day archive horizon; secondary export/rotation not implemented;
   growing poll/transition registry and no proactive alerting. Activation remains
   incomplete, with remote steps pending credential verification.
