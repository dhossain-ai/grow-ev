# Grow EV — Current Project Status

Updated: 2026-10-10
Phase: Cloudflare public deployment verified; TASK-012 workflow prepared, secrets/TLS and write approvals pending

## Verified foundation

- TASK-001 through TASK-005 completed: Expo SDK 57 / strict TypeScript,
  universal MapLibre, Via Lietuva investigation, Supabase/PostGIS foundation,
  one-shot collector and real-data map.
- Earlier verified DEV collection: 1,984 locations, 5,836 EVSEs, 5,838 connectors;
  canonical identities and unchanged-status nontransitions preserved.
- Earlier Chrome/Pixel_8 map checks passed. Physical-device validation remains
  unverified; current builds are not a claim of current device interaction.

## Current work

- Routing stability checkpoint committed separately as `968c567`: in-flight sharing,
  bounded 30-second cache and cooldown handling reviewed; 41 tests/local checks
  passed. Modified Edge Function **not deployed** and still requires explicit
  deployment approval. Android Fabric SIGSEGV remains unresolved.
- TASK-009 provisionally checkpointed as `ca6ca98` (visual acceptance incomplete): Driver / Network
  navigation, foreground-only explicit user location, polished map controls and
  expandable station details, responsive read-only dashboard, connector-scoped distinct EVSE
  metrics, observation freshness and cross-operator compatible capacity pairs.
  Existing public RPCs only; no migration, collector, route requests or polling.
  Scope is the stated Vilnius study window intersected with the existing evidence
  radius, not a whole-city/national census. See `tasks/active/TASK-009.md`.

- TASK-006 provisionally committed as `95764d1`. Hotspot restored verified-TLS
  DEV database connectivity. Exactly one expected migration was pending and
  `20261010002000_station_capacity_rpc.sql` was applied to DEV. Remote correctness/
  security SQL and public anonymous table denial passed. Fresh compatible
  recommendations and selection/recentering passed in production Chrome.
  Pixel_8 real-data recommendations, connector switching, safe routing failure and
  selection/recentering passed after cold relaunch. Native startup instability
  remains a limitation. Successful road-routing integration is now verified below.
- TASK-007 provisionally committed as `9402063`: shared routing contract,
  server-side TomTom adapter and bounded Edge Function, explicit charger-to-charger
  UI with unavailable/error handling. Reviewed frontend credential exclusion and
  request budgets; driver/server TypeScript, zero-warning lint, all 24 tests and
  web production build passed again before the checkpoint. Approved DEV deployment
  and live routes passed; real provider rate limits were also observed.
- TASK-008 implemented locally: deterministic policy reuses fresh compatible
  capacity and existing nearest-three shortlist. Complete comparable fresh routes
  rank by estimated driving time; partial/missing routes retain geographic order.
  Shared cards show one primary and up to two explained alternatives, retain
  station selection/recentering and never invent ETA/wait/price/probability.
  Optional supplied user origin is distinct from selected-charger origin;
  TASK-009 now supplies an explicitly requested foreground fix. See `tasks/active/TASK-008.md`.
- TASK-008 committed as `437efee` after review, driver/server TypeScript, driver
  lint and 37 tests passed. Credential-pattern scan of all 94 tracked/unignored
  files passed; explicit staging allowlist used. Fresh real-data recommendations,
  actual road-time ranking, both alternatives and primary selection/recentering
  passed through production Chrome and Pixel_8. No product source changes were
  required in this live verification.

## Connectivity and live gates

- Mobile hotspot database/public API connectivity passed independently of CLI
  authorization. User restored DEV CLI access; server secret name verified.
  No credentials printed or copied into Expo; no TLS/RLS bypass.
- TASK-006 migration applied under existing conditional approval. Applied migration
  files and collector implementation remain unchanged. No reset or scheduling.
- ONE collector poll executed: `125766b8-62ec-45d9-8af0-c3467437558a`, SUCCESS/
  COMPLETE, 1,984 locations / 5,836 EVSEs / 5,838 connectors, zero duplicates.
  Baseline verification passed: all canonical IDs/first observations preserved,
  all observation times advanced, exactly 66 genuine changes and no false
  transitions. One-poll approval is consumed; do not rerun automatically.
- Observations: 2026-10-10 03:46:01.044–03:46:04.628 Europe/Vilnius. At verification,
  Norfa XXL Ateities g. 10 had two occupied CCS2 EVSEs and no available CCS2;
  its available Type 2 EVSE correctly did not supply CCS2 capacity. Geographic
  primary Jeruzalė: 2 available CCS2 EVSEs, 0.471 km; Rimi Jeruzalė: 2, 0.497 km;
  Baltupių turgus: 1, 0.925 km. These are observed snapshots, not arrival guarantees.
- Exact DEV routing deployment explicitly approved by the user and completed:
  `npx supabase functions deploy routing --project-ref heafsrqaytsfthfcxmqu --use-api`.
  Existing `verify_jwt=false` permits guest routing. `TOMTOM_API_KEY` stays in DEV
  Edge secrets; deployment used the existing audited implementation.
- Actual Norfa-to-Vilnius estimates at 04:14–04:18 Europe/Vilnius: primary Rimi
  Jeruzalė 163 s / 744 m (2 available CCS2); Jeruzalė 173 s / 537 m (2); Baltupių
  turgus 293 s / 1,621 m (1). Differences 10 s and 130 s match calculations.
  All returned traffic-aware summaries; these are provider estimates, not measured
  journeys or guaranteed traffic coverage. UI labels the selected-charger origin.
- Production Chrome and Pixel_8 passed Compare → road-ranked primary/two
  alternatives → select Rimi Jeruzalė → fresh available details/recentered map.
  Expired two-minute routes were withheld and geographic fallback restored.
  Saved actual routes replayed through the domain policy validate ranking,
  explanations, stale evidence exclusion and rejection under a different explicit
  user origin. No driver/GPS origin was supplied; physical-device routing unrun.
- Deployed OPTIONS/GET, invalid JSON, oversized body, missing/invalid origin,
  duplicate/too-many destinations and >15 km bounds passed. Real provider
  `EXTERNAL_RATE_LIMITED` appeared both in partial 200 results and all-failed HTTP
  429, with sanitized errors and `Retry-After: 60`. Bounded verification stopped;
  quota availability needs checking privately before recording the video.
  An initial helper assumed complete success/local-only 429; corrected checks
  accepted the documented partial/provider-limit contract. Timeout and isolate
  concurrency/minute-budget/reset/backoff proofs remain deterministic tests;
  distributed/global budget enforcement is not established.
- TomTom secrets stay server-side. Edge budgets are per isolate; distributed
  spending/abuse controls remain necessary before public deployment.

## TASK-010 local redesign — 2026-10-10

Light Calm Electric driver assistant, consistent connector selection, explicit station
choice, recommendation hero, progressive station information and separately labeled
recorded Norfa/Rimi case. Network Intelligence is secondary navigation with light
paired opportunity cards; underlying calculations and coverage remain unchanged.
TASK-010 remains uncommitted. Existing backend, routing contracts and location safety
are preserved; no collector, TomTom requests, migrations or deployments.

Final checks and screenshot review are recorded in `tasks/active/TASK-010.md` and
`artifacts/task-010/README.md`. User visual acceptance, fresh live recommendation
interaction, physical devices and Android startup reliability remain unverified.

## Latest local verification

### TASK-009 UI polish and location review — 2026-10-10

- Driver strict TypeScript, zero-warning ESLint and all 58 regression tests passed
  (zero failures/skips). Production web export and final Android JS/Hermes export
  passed. Android debug assembly passed online after the new location artifact
  was unavailable offline: 6m37s, 376 tasks. APK installed on Pixel_8.
- Chrome production UI at 390x844 and 1440x1000 and Pixel_8 UI were exercised:
  navigation, filters, station selection, expandable sheet, dashboard stale
  statistics and explicit user-origin opt-in. Simulated Vilnius fixes show the
  blue location dot and recentering on both platforms. Android permission denial
  and disabled-services errors plus browser unavailable/timeout messages were observed. No physical GPS claim.
- Only explicit foreground fixes, expiring after two minutes/backgrounding;
  no watcher or persistence. Background location/service permissions excluded.
  Expo-compatible expo-location is the only new dependency.
- CCS2 data remains historical: 140 locations / 379 EVSEs, dated statuses
  334 AVAILABLE, 12 CHARGING, 0 UNKNOWN, 33 other unavailable. Main card compares
  Elektrum PLTVILU231_EDLT-66 with Ignitis IKI Fabijoniškės, 6 compatible snapshot
  AVAILABLE EVSEs at 0.209 km straight-line. Current availability is unverified.
- Captures and verification limits: artifacts/task-009-polish/README.md.
  Fresh user-origin provider/primary-selection UI, physical devices, full keyboard
  accessibility and user visual acceptance remain unverified. Existing Android
  Fabric startup instability remains unresolved. No collector, TomTom requests,
  migration, deployment or commit in this task. Routing Edge patch still needs
  separate explicit deployment approval.

### Demo stabilization checkpoint — 2026-10-10

- Existing sanitized DEV evidence confirms upstream TomTom `EXTERNAL_RATE_LIMITED`
  in partial HTTP 200 and all-failed HTTP 429. Edge `RATE_LIMITED` separately means
  isolate budget/concurrency/provider backoff. No new live TomTom calls made.
- Driver routing now shares identical in-flight requests across subscribers,
  cancels HTTP only when all subscribers leave, and caches at most 20 exact
  origin/ordered-destination batches for 30 seconds. Route calculation timestamps
  stay unchanged; original two-minute expiry remains authoritative. Comparison
  still requires an explicit press; map movement and unchanged selections trigger
  no automatic routing. Rapid repeat presses are blocked synchronously.
- Full/partial rate limits start a session-local cooldown of at least 60 seconds;
  numeric Retry-After is used with a one-hour bound. Compare shows a cooldown label.
  Known partial routes are retained, missing times remain unknown, no automatic
  retry. These are efficiency measures, not distributed quota protection.
- Local Edge patch exposes Retry-After to browsers and reports upstream 429 when
  another destination failed first with timeout/unavailability. Positional outcomes
  remain unchanged. **Not deployed**; separate approval required.
- Pixel_8 crash reproduced after an initial five-second alive check: SIGSEGV /
  SEGV_ACCERR on `mqt_v_js`, React Native `MountingCoordinator::pullTransaction`
  +713 → `FabricUIManagerBinding::schedulerDidFinishTransaction`. Earlier saved
  trace matches. No named app/map component established; no speculative native
  fix, architecture switch or map rewrite. Five short launch checks were insufficient;
  three additional 20-second cold launches stayed alive/foreground without crashes.
  Final native UI dump showed map filters. This sample does not resolve intermittency.
  Sanitized traces/results retained in ignored `services/ingestion/.scratch/`.
- Driver/server TypeScript, driver/server zero-warning ESLint, 41 regression tests,
  web production build, Android JS/Hermes export and offline debug build passed
  (1m 47s, 376 tasks). Known Gradle deprecation/cross-drive copy warnings only.
  Historical-clock replay of saved actual routes with unchanged read-only DEV
  capacity passed ranking [163,173,293], counts [2,2,1], distances [744,537,1621],
  differences [0,10,130], route expiry and origin isolation. Current observations
  are stale and correctly withhold recommendations. This is replay proof, not a
  renewed live interactive journey. No collector, migration or deployment run.
- Failed: native startup reliability (reproduced crash). Unrun: new complete live
  web/native recommendation journey, physical device, modified Edge runtime/deploy.
  Stability review passed: driver/server TypeScript, zero-warning lint, 41 tests,
  web export and diff check rerun. Separate stability commit authorized.
  Modified Edge Function requires explicit deployment approval; not deployed.
  TASK-009 remains unstarted at this checkpoint.

Filming fallback: use the previously captured genuine web/Pixel_8 screenshots as
an explicitly dated recorded demonstration. For a new live recording, prefer the
production web build; privately check provider quota and obtain separate approval
for an observation refresh, then compare once. Do not change observation/route
timestamps or replay old data as current. Android filming should start only after
a successful warm-up and use web/recorded evidence if it crashes.

- TASK-008: 37 unit/API tests passed (13 new recommendation tests), zero failures
  or skips. Fixtures cover compatibility/congestion, freshness, UNKNOWN/outages,
  multiple connectors, ranking/ties, partial/failed routes, route-origin matching,
  explanations and mocked HTTP integration. Final builds/checks recorded in task.
- Driver/server and ingestion TypeScript, zero-warning driver/server lint, all
  37 driver tests, web production export, Android JS/Hermes export and offline
  Android debug build passed again. Ingestion tests: 13 passed, 1 PostgreSQL suite
  skipped (no disposable database configured); no failed test suites. Remote SQL
  and public map security checks passed. Native build: 1m 28s, 376 tasks.
- Temporary verification helpers initially failed on CLI URL quoting/relative CA
  paths and JS Date comparison formats; corrected checks passed before accepting
  results. Test web server initially lacked the `.mjs` MIME type; corrected and
  browser verification passed. Old Metro lacked the shared routing watch folder;
  emulator connection required all-interface Metro binding and ADB reverse.
  First connected native launch crashed with SIGSEGV in React Native Fabric
  `MountingCoordinator::pullTransaction`; subsequent cold relaunch passed the
  live journey. Crash retained in ignored `.scratch/android-crash.log`; startup
  reliability is not proven. No product code change claimed.
- Unit fixtures are synthetic. Fresh DEV evidence and web interaction are real.
  Actual route/provider integration and UI interaction are now verified. They do
  not establish road reachability under fallback, arrival availability,
  traffic sensor coverage or physical-device success. Driver/server TypeScript,
  zero-warning lint and all 37 tests passed again after deployment.

## Deferred product scope

Unapproved scheduled ingestion, historical analytics beyond dated snapshot patterns, ML, pricing, waiting-time
predictions and background location remain outside this slice.
Earlier audit reported 29 transitive advisories (10 moderate, 19 high) upstream of
Expo SDK 57. Installing expo-location reported the same 29 advisories; upstream remediation is deferred.

## Next

Review TASK-010 screenshots and uncommitted implementation. TASK-009 checkpoint is
`ca6ca98`; its visual acceptance was incomplete. Do not commit TASK-010 until reviewed.
Fresh observations require separately approved collection; provider comparison needs
quota availability. Existing modified routing Edge Function remains undeployed, and
Android Fabric startup reliability remains unresolved. Stop for review.

## TASK-011 release engineering takeover — 2026-10-10

Baseline main `bbf4c878` failed npm ci in matching GitHub run `38048704760`.
Linux clean installation reproduced and verified the minimal two-entry lock repair.
Tracked Expo types fix fresh-checkout CSS typechecking. Driver TypeScript, zero-warning
lint and 61 tests passed; ingestion TypeScript and 13 tests passed (database suite skipped).
Both workflows passed actionlint; corrected Wrangler configuration passed installed CLI
dry-run. Public Supabase settings now support existing GitHub secrets as fallback.
Collector remains manual-only and unrun. Existing DEV routing remains deployed; the
undeployed local patch does not disable it. No routing/provider requests or Supabase changes.
See TASK-011 for exact versions and validation limits.

## TASK-012 observations automation — 2026-10-10

Later Deploy Web run `38050786913` succeeded for the same release SHA `ff2e2d6`.
Public `https://grow-ev-demo.dhossain.workers.dev/` and Network Intelligence were
browser-verified around 15:20 Europe/Vilnius. This supersedes the earlier Cloudflare
registration blocker. Existing observations remain dated 03:46:01–03:46:04;
379 CCS2 and 1,434 Type 2 observations are stale, fresh pairs/recommendations withheld.
Fetching is correctly labeled separately from observation time. Provider update age
is not exposed by the existing public contract; acceptance limitation remains.

Collector workflow now prepares default read-only preflight, explicit DEV project,
required private CA/URL configuration and preflight-before-writer gating. Existing
collector, application and migrations remain unchanged; schedule remains disabled.
GitHub collector secret names are missing. Local read-only preflight failed TLS
verification before database health/baseline queries; no verification bypass.
No DEV writes or TomTom calls executed. GitHub preflight, one explicitly approved
manual collector test and separately approved cadence remain pending.

Ingestion TypeScript/non-database tests and all ten disposable PostgreSQL regression
tests passed; corrected workflow passed actionlint. See `tasks/active/TASK-012.md`
for security, monitoring, remaining checks and approval gates. Stop for review.
