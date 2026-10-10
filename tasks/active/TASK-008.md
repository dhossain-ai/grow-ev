# TASK-008 — Explainable deterministic recommendations

Status: Complete — live integration verified on production web and Pixel_8; committed as `437efee`. Subsequent stability checkpoint reviewed for a separate commit. Physical-device and native startup reliability remain unverified.
Date: 2026-10-10

## Scope and policy

Build the smallest recommendation slice on TASK-006 capacity and TASK-007 routing.
TASK-006 checkpoint: `95764d1`; TASK-007: `9402063`. Their DEV migration and
approved routing deployment now support live verification recorded below.
TASK-008 adds no migrations, collector changes or separate service deployment.

- Pure `recommendAlternatives` uses existing canonical EVSE compatibility and
  freshness rules, without duplicated capacity calculations. Only confirmed fresh
  congestion at the selected station triggers alternative recommendations.
  If the selected station has compatible AVAILABLE capacity, retain its available
  explanation; no rerouting recommendation. UNKNOWN/outages alone do not invent
  congestion. Missing/stale selected evidence cannot justify this recommendation.
- Eligible alternatives must have at least one fresh compatible AVAILABLE EVSE.
  Multiple connectors do not inflate counts. Unknown/out-of-service/incompatible
  EVSEs supply no available capacity. Stale/invalid/future observations remain
  excluded; the existing inclusive 60-minute ceiling is unchanged. Other stale
  EVSEs at a qualifying station are excluded and explicitly disclosed.
- Use the existing nearest-three shortlist within 10 km straight-line of the
  selected charger. Geographic ties: more compatible AVAILABLE EVSEs, then ID.
  This is not an exhaustive search for the fastest station in the entire radius.
- Validate each supplied route, matching exact origin/destination, provider,
  finite nonnegative duration/distance, and calculation age from 0–120 seconds.
  Rejected routes and error outcomes remain unknown, never zero-duration fallbacks.
- With complete fresh comparable route coverage (same traffic-awareness setting),
  rank by provider-estimated driving seconds, then geographic distance, compatible
  available count, and station ID. Otherwise retain geographic order for the
  whole shortlist. Missing routes are not evidence of slower driving.
- Display known route durations even with partial coverage; driving differences
  are signed differences from the primary recommendation only where both routes
  use the same origin and traffic-awareness setting. No comparison with waiting,
  overall journey, unobserved arrival capacity or staying at the selected charger.
- Default origin is the selected charger; explicitly label charger-to-charger
  travel. Optional `userOrigin` coordinates are threaded through existing details
  components and used for routing when supplied; differently originated results
  cannot be reused. The current map supplies no actual user location and this task
  adds no GPS, permissions, geolocation or location-entry flow. Geographic fallback
  always stays explicitly measured from the selected charger, even with user origin.

## UI and explanations

Reuse `CongestionDetail`/`AlternativeRouting`/`StationDetail` and design tokens.
Replace duplicate route and alternative lists with a single selectable card per
recommendation: accent-bordered primary "Recommended", then up to two alternatives.
Selection still uses existing map recentering. Explicit Compare action requests
only the existing shortlist; no routing on pan/zoom/ticks, no retries added.

Each card explains compatible AVAILABLE EVSE count, selected-station congestion,
straight-line proximity, age of the oldest supporting available observation and
freshness limit. Known routes retain road distance, provider, calculation time,
traffic-awareness and origin label. Applicable route-time differences reference
the primary. Missing/error/expired routes display "Driving time unavailable" and
state that fallback geographic proximity does not confirm road reachability.

Observation time is not charging-session duration or proof of continuous
availability. Availability can change before arrival. No waiting time, charging
duration, prices, probabilities, scores, ML or dashboard functionality.

## Offline checks

Synthetic evidence and mocked routing HTTP only. Final commands/results below.

## Final checkpoint review — 2026-10-10

Live capacity, TomTom estimates, recommendations and selection/recentering passed
on production web and Pixel_8 as recorded below. Earlier pending/unrun statements
are historical checkpoint records superseded by the final integration evidence.
Physical-device and actual user-origin routing remain unrun. TomTom 429 responses
and intermittent Fabric startup crashes remain known limitations. Per-isolate
budgets do not protect global quota. No collector rerun or deployment in this pass.

Reviewed all pending implementation and documentation changes. TASK-006/007 and
API/architecture/data-model records describe already authorized integration;
applied migrations and collector code unchanged. Driver/server TypeScript,
zero-warning lint and all 37 driver tests passed again before commit. Route
identity, freshness, timestamps, explicit origins and unknown-duration safeguards
intact. User authorized this checkpoint; later stability changes stay uncommitted.

## Executed local checks — 2026-10-10

From `apps/driver`:

- `npm run typecheck` — passed (strict TypeScript).
- `npm run lint -- --max-warnings 0` — passed, zero lint warnings/errors.
- `node ./node_modules/typescript/bin/tsc -p ../../supabase/functions/tsconfig.json`
  — passed; unchanged routing server/shared contract remains compatible.
- `node --test scripts/map.test.mjs scripts/congestion.test.mjs scripts/routing.test.mjs scripts/recommendations.test.mjs`
  — **37 passed**, zero failures/skips, including 13 new recommendation tests.
  Controlled fixtures test fresh congestion, compatible availability, incompatible
  EVSEs, UNKNOWN/outages, freshness boundary/stale/future/invalid observations,
  missing/failed/malformed/mismatched/expired routes, multiple connectors, tie
  ranking, origin distinction, mixed traffic settings, exact explanations and
  mocked HTTP-to-ranking candidate identity integration.
- `npm run build:web` — passed; production export, including final review's
  "Oldest available observation" label. Web/native exports both passed again
  after the label clarification, which avoids implying continuous availability.
- `npx expo export --platform android --output-dir dist/android-check` — passed;
  native JS/Hermes export of recommendation integration; ignored artifacts.
- From `apps/driver/android`: `./gradlew.bat app:assembleDebug --offline` —
  **BUILD SUCCESSFUL** in 1m 13s, 376 tasks (55 executed, 321 up-to-date).
  Known cross-drive hard-link copy fallback and Gradle deprecation warnings.
- `git diff --check` — passed. No migration/collector diffs; TASK-008 unstaged and
  uncommitted. TASK-007 provisional checkpoint is `9402063`.
- Frontend source and final generated web JS check — passed: no TomTom secret
  name/provider host or privileged credential patterns. Only existing public
  Supabase configuration is used. Staged diff is empty.
- Failed checks: none in TASK-008. Unrun: interactive web/Android/emulator/device
  verification, live capacity/routing, Deno/Edge runtime/deployment and remote SQL.
  Local SQL from TASK-006 not rerun. Builds/tests are not successful live routing
  or physical-device proof.

## Changed files

- `apps/driver/src/features/map/recommendations.ts`: pure recommendation policy,
  validated route matching, primary-relative differences and evidence explanations.
- `AlternativeRouting.tsx`: reused routing interaction, integrated single ranked
  selectable card list and primary styling; no new map event requests.
- `CongestionDetail.tsx`: removes duplicate alternatives; passes authoritative
  evidence/connector to recommendation display.
- `StationDetail.tsx`, `routingApi.ts`: optional supplied user-origin plumbing;
  default remains selected charger. No geolocation acquisition added.
- `apps/driver/scripts/recommendations.test.mjs`: synthetic unit/HTTP regressions.
- `docs/INTELLIGENCE.md`, `PRODUCT.md`, `STATUS.md`, this task: current policy,
  product slice, checkpoint references and verified/pending status.

Stop for review. No TASK-008 commit or deployment.

## Hotspot real-data integration — 2026-10-10

TASK-006 RPC deployed and remote security SQL passed; one approved collector
refresh completed. See TASK-006 for canonical/transition audit. Fresh public
capacity evidence validates Norfa XXL Ateities g. 10 CCS2 congestion: 0 available,
2 charging; available Type 2 excluded. Implemented policy selects primary
Jeruzalė (2 available CCS2, 0.471 km straight-line), then Rimi Jeruzalė (2,
0.497 km) and Baltupių turgus (1, 0.925 km). Exactly three fresh compatible
alternatives, distinct canonical counting and matching explanations verified.
In-memory aged copies of real evidence produce no recommendations; database
observations unchanged. No fabricated price/wait/probability/ETA.

Production Chrome journey passed: map → CCS2 filter → congested Norfa → primary
and two alternatives → Compare driving times (safe unavailable result) → select
Jeruzalė → new available station details and recentered map. Origin label is
charger-to-charger. No user/GPS origin provided or inferred. Driver-origin isolation
remains unit-tested only; real origin routing is pending. Public API verification
and screenshots are genuine DEV data, with no browser response substitution.

Real road-time ordering/differences, traffic semantics and complete successful
routing remain unverified: TASK-007 needs DEV management access, private server
secret verification and explicit deployment confirmation. Pixel_8 real-data
journey passed after cold relaunch: CCS2 filter, Norfa selection, explicit Type 2
available/CCS2 congestion switching, primary/both alternatives, Compare's safe
unavailable result and Jeruzalė selection/recentering. First connected launch
crashed in native Fabric; subsequent run passed, so startup reliability remains
unverified. Screenshots/crash log retained in ignored `.scratch/`. Physical device
unrun. No successful real route comparison claimed. Endpoint is HTTP 404/NOT_FOUND.

Rerun checks: strict driver/server/ingestion TypeScript; zero-warning driver/server
lint; 37 driver tests; 13 ingestion tests passed with one PostgreSQL suite skipped;
web production build; Android JS/Hermes export; offline debug build (1m 28s,
376 tasks); remote capacity SQL; public map/security verification; diff check.
No product code changes in this integration attempt. Existing TASK-008 work is
preserved, uncommitted and unstaged. Stop for review at the routing gate.

## Actual routing and complete driver journey — 2026-10-10

TASK-007's explicitly approved DEV deployment succeeded. Real Norfa CCS2 capacity
still has 0 available / 2 charging; its available Type 2 is excluded. Actual
TomTom routes change the primary from geographic-nearest Jeruzalė to fastest-road
Rimi Jeruzalė: 2 compatible available EVSEs, 163 seconds / 744 metres. Secondary
Jeruzalė: 2 available, 173 seconds / 537 metres (+10 seconds); Baltupių turgus:
1 available, 293 seconds / 1,621 metres (+130 seconds). All three traffic-aware
summaries are comparable provider estimates. Availability observations date from
03:46 local and were within the 60-minute limit during the 04:14–04:18 checks.

Production Chrome and Pixel_8 passed real map/CCS2 selection → congested Norfa →
Compare → road-ranked primary and both alternatives → select Rimi Jeruzalė →
available details and recentered map. Exact displayed explanations/differences
match counts, oldest observations and route calculations. Selected-charger origin
is explicit; no user origin inferred. Expired routes restore geographic fallback
without numeric ETAs. Saved actual provider routes replayed through current domain
source validate ranking/deltas/counts/explanations, stale-observation exclusion,
route expiry and rejection when an explicitly different user origin is supplied.
This replay is distinguished from the live UI/provider requests. Explicit actual
driver-origin routing remains unrun because no driver origin was supplied.

Deployed invalid-request handling passed. Real provider rate limits preserve
partial success and return sanitized 429/Retry-After 60 when all routes fail;
see TASK-007. No invented wait, price, probability or total charging journey time.
Native startup reliability remains limited by the earlier Fabric crash; successful
current run is emulator proof, not physical-device proof. Screenshots are retained
in ignored `.scratch/web-live-routing.png`, `android-live-routing.png`,
`android-live-secondary.png`, `web-live-selected.png`, `android-live-selected.png`.

Post-deployment 37 tests, driver/server TypeScript and lint passed. Prior
same-session web production build and Android export/debug build passed, with
unchanged source since those builds. Task/status/API/architecture/intelligence
records updated; no implementation changes for this verification, no commit or
staging. Stop for review. Before video: privately verify provider quota and obtain
new approval for another collector refresh if observations have expired.

## Finalization and demo stability — 2026-10-10

TASK-008 committed as `437efee68a0439b44b09009532e3cc5a6dae200c` after complete
diff review, credential-pattern scan (94 tracked/unignored files, no matches),
unchanged applied migrations/collector and passing precommit checks (37 tests).
Prior no-commit statements are historical; this user explicitly authorized commit.

Subsequent stability changes remain uncommitted for review: `routingApi.ts` adds
exact-batch in-flight sharing, subscriber cancellation, bounded 30-second caching
and full/partial 429 cooldown; `AlternativeRouting.tsx` guards repeat presses and
shows cooldown; `routing/handler.ts` preserves upstream-limit classification under
mixed failures and exposes Retry-After (not deployed); `routing.test.mjs` covers
these behaviors. No timestamp refresh, invented route or automatic retry.

Checks executed after stabilization:
- `npm run typecheck` and server `tsc -p ../../supabase/functions/tsconfig.json`: passed.
- `npm run lint -- --max-warnings 0` and root ESLint for `supabase/functions`
  / `packages/routing` with existing `eslint.config.cjs`: passed, zero findings.
- `node --test scripts/map.test.mjs scripts/congestion.test.mjs scripts/routing.test.mjs scripts/recommendations.test.mjs`: 41 passed, no failures/skips.
- `npm run build:web`: passed.
- `npx expo export --platform android --output-dir dist/android-check`: passed.
- `./gradlew.bat app:assembleDebug --offline`: passed, 1m 47s, 376 tasks.
- Saved actual route replay with unchanged read-only DEV observations: passed
  exact ranking/counts/distances/differences, expiry/origin isolation and present
  stale-evidence rejection, zero TomTom calls. Full new live journey cannot be
  repeated with expired observations and no refresh authorization.

Native reliability failed: matching Fabric SIGSEGV reproduced after five-second
checks had appeared successful. Three subsequent 20-second cold launches stayed
alive and foreground; final UI dump showed map filters. No causal MapLibre/app
component identified or native fix claimed. Sanitized evidence and safe filming
fallback are recorded in STATUS. Physical device / modified Edge deployment
unrun. No collector, migration, architecture toggle or TASK-009 work. Stop for review.

## Stability checkpoint review — 2026-10-10

Reviewed all eight pending files: no unrelated changes or credential findings.
Original route calculation timestamps/expiry preserved, no automatic retries,
upstream EXTERNAL_RATE_LIMITED and isolate RATE_LIMITED remain distinct.
Cooldown blocks new HTTP; valid cached/partial routes and geographic fallback
remain usable. Driver/server TypeScript and zero-warning lint, 41 tests, web
production export and diff check rerun and passed. Prior Android build evidence
remains recorded above; Fabric SIGSEGV unresolved.
Modified Edge Function still requires explicit deployment approval. Not deployed.
