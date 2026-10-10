# TASK-006 — Grow EV Congestion Intelligence

Status: DEV migration/security, fresh collection and real recommendations verified on web/Pixel_8; native startup instability recorded.
Date: 2026-10-10

## Scope and implementation

- Exact OCPI connector choice: CCS2, Type 2, CHAdeMO. Shared labels with map filters;
  the driver connector requirement in details is independent of discovery filters.
- Pure, testable TypeScript module counts distinct canonical EVSEs, never connector
  options or unrelated station aggregates. Fresh AVAILABLE evidence must belong
  to an EVSE with the selected standard.
- Congestion requires no compatible AVAILABLE and at least one compatible
  CHARGING/BLOCKED/RESERVED EVSE. UNKNOWN, outages, no compatibility and stale
  observations have separate explanations. Occupancy does not imply post-charge idling.
- Conservative 60-minute freshness ceiling; future/invalid observations excluded.
  Any stale compatible evidence prevents asserting saturation unless fresh
  available capacity already proves availability. Fresh available EVSEs can still
  qualify an alternative with other stale/unknown EVSEs; only the fresh available
  count is advertised.
- Search within 10 km of the selected station, independent of viewport/operator.
  Eligibility first, geographic proximity next, compatible available count as a
  distance tie-breaker, canonical ID for determinism. Up to three alternatives.
- Shared minimal details component displays capacity, explanations, unknown/stale
  counts, timestamps, station/operator, explicitly straight-line km and selection.
  Web/native selection replaces details and recenters the map. Freshness reevaluates
  every 15 seconds. Requests cancel on station switch, time out after 20 seconds,
  and expose failure/retry without reusing failed evidence.

## Database inspection and review artifact

Existing `get_map_stations` does correlate connector filtering at EVSE level.
Its unfiltered aggregates cannot establish compatibility. Even its filtered
response combines BLOCKED with outages and RESERVED with UNKNOWN and reports
the newest EVSE observation; it cannot satisfy exact congestion/freshness rules.

New migration `supabase/migrations/20261010002000_station_capacity_rpc.sql` adds
`get_station_capacity(uuid)` returning allowlisted station metadata and each
canonical EVSE's status/time/standards. Bounded indexed PostGIS geography query,
trusted search path, explicit anon/authenticated EXECUTE, revoked PUBLIC EXECUTE,
no direct table grants/RLS changes. One record per EVSE before connector aggregation.
Rejects unknown/null targets and more than 2,000 nearby stations. Public client
pages PostgREST and validates complete, unique station/EVSE evidence.

Migration was **not applied remotely**. During final verification it compiled and
applied successfully only to disposable WSL `growev_collector_test` (PostgreSQL
16.15 / PostGIS 3.4.2). The earlier statement that no local runtime was available
was incorrect. `supabase/tests/station_capacity_live.sql` now passes locally after
fixing JSON operator precedence; it checks canonical counts/associations/timestamps,
spatial completeness, field allowlists, invalid inputs, function configuration,
both client roles' table privileges/RLS and actual anonymous table-access denial.
User conditionally approved remote deployment; the pending-list dry-run gate is
blocked. Existing applied migrations unchanged.

## Real-data example, not a current recommendation

Read-only public `get_map_stations` with CCS2 filtering in Vilnius on 2026-10-10:

| Station / operator | Compatible snapshot capacity | Straight-line from target |
| --- | --- | --- |
| PLTVILSPA7_EDLT-75, Spaudos g. 7 / Elektrum Lietuva | 0 AVAILABLE, 2 CHARGING | Target |
| Moonplay / Ignitis | 1 AVAILABLE EVSE | 0.122 km |
| Vilnius Outlet / Enefit | 8 AVAILABLE EVSEs | 0.421 km |
| Norfa XL A. P. Kavoliuko g. 6 / Enefit | 4 AVAILABLE EVSEs | 0.448 km |

All observations: `2026-10-09T21:52:03.348Z` (2026-10-10 00:52:03 Europe/Vilnius).
They are stale and would be withheld by TASK-006. Existing filtered RPC verifies
these historical compatible counts; the new endpoint is not yet live. No collector
run, scheduling, simulated database measurements or physical arrival verification.

## Executed checks

From `apps/driver`:

- `npm run typecheck` — passed.
- `npm run lint` — passed, zero warnings after fixing the initial effect reset error.
- `node --test scripts/map.test.mjs scripts/congestion.test.mjs` — 14 passed,
  zero failures/skips. Includes incompatible availability, multiple connectors,
  distinct IDs, occupied/reserved/blocked, UNKNOWN/outages, stale/future/invalid
  observations, freshness boundary, radius/ranking/top three/no alternatives,
  validation, pagination, request cancellation signal and API failures.
- `node --env-file=.env.local scripts/verify-map-live.mjs` — passed; existing
  live map still returns 1,984 stations / 5,836 EVSEs, 923 stations in Vilnius bounds;
  public field allowlist, pagination, invalid requests and table access denial pass.
- `npm run build:web` — passed after final code simplification.
- `android/gradlew.bat app:assembleDebug` — BUILD SUCCESSFUL, 376 tasks.
- `git diff --check` — passed.

## Platform verification

- Production web at localhost:8082: real map renders, selection opens new details,
  undeployed capacity endpoint produces visible failure/retry. Browser-only synthetic
  responses verify CCS2 congestion despite an incompatible AVAILABLE Type 2 EVSE,
  alternative count/operator/distance/freshness, Type 2 available state, CHAdeMO
  no-compatible state, and selecting an alternative updates details and recenters.
  Browser interception cleared and page restored/reloaded; test tab closed.
  Upstream basemap missing `office` sprite warning observed; no application error.
- Pixel_8 emulator: cold boot restored after disconnect, current APK installed,
  Metro bundle loaded, map markers/clusters and selected station details verified.
  Peteliškių g. 40 shows connector choices, capacity failure and retry; Type 2
  selection and retry exercised. No successful native recommendation interaction
  with a deployed endpoint; no physical Android-device validation.

## Changed files

- `apps/driver/src/features/map/congestion.ts`: deterministic domain rules/validation.
- `capacityApi.ts`, `CongestionDetail.tsx` in the same folder: public evidence client/UI.
- `StationDetail.tsx`, `FilterBar.tsx`: shared integration/connector mapping.
- `apps/driver/src/components/GrowMap.web.tsx`, `GrowMap.native.tsx`: alternative selection/recentering.
- `apps/driver/scripts/congestion.test.mjs`: synthetic unit/API regression tests.
- New Supabase migration and read-only SQL verification file described above.
- `docs/INTELLIGENCE.md`, `docs/DATA_MODEL.md`, `docs/STATUS.md`: actual contract,
  algorithm decisions and pending verification state.

## Review gate and remaining acceptance

User approved deployment to `heafsrqaytsfthfcxmqu` and ONE existing live collector
execution, subject to safety checks. Restore DEV database connectivity; then
confirm only TASK-006 is pending via CLI dry-run before deployment. Run remote
SQL checks and capture a read-only canonical baseline before the single approved
collector execution. Verify identity stability, exact genuine transitions and
unchanged-status nontransitions against that baseline; no blind collector retry.
Then verify real recommendations and successful screenshots on web/Android.
Stale observations remain excluded; provider `last_updated` remains separate from
actual `last_observed_at`, and offset-free timestamps are not assigned a timezone.
No routing, ML, predictions, tariffs, ingestion changes, new dependencies or commit.
Stop here; no next task started.

## Final live-verification attempt — 2026-10-10

- Target guards: linked ref matches `heafsrqaytsfthfcxmqu`; server URL has the
  same project's session-pooler username/port and verified CA configuration.
- Linked CLI dry-run failed at login-role initialization with HTTP 403. Existing
  supplied password avoids that management step, but Windows and WSL dry-runs
  failed at database TCP connection (port 5432). Direct hostname did not resolve;
  transaction-pooler 6543 and the session pooler's published IPv4 addresses also
  failed Windows probes. WSL Node/CLI connection attempts timed out as well.
  An initial shell probe suggested WSL connectivity, but subsequent explicit
  per-address probes disproved it. No TLS-verification bypass or firewall change.
- Pending migration list could **not** be established. Safety condition unmet;
  no DEV `db push`, no remote schema/table modifications, no reset.
- `npm run collect -- --check` failed before polling. **Zero live collector
  executions**; the approval for one poll has not been consumed. Collector code
  and environment credentials unchanged; no source refresh or replay attempted.
- Disposable local migration and updated SQL suite passed. The migration itself
  was not edited. Local collector integration tests operate only on guarded
  loopback `growev_collector_test` synthetic fixtures; they are not DEV polls.
- `npm run typecheck` (ingestion) passed. Ordinary `npm test` gave 13 passes and
  one explicitly skipped PostgreSQL suite; rerun using WSL Node and ignored
  `.scratch/test.env` executed **all 23 tests: passed, zero failed/skipped**.
- Driver `npm run typecheck`, zero-warning `npm run lint`, 14 unit/API tests and
  `npm run build:web` passed again. Existing `verify-map-live.mjs` passed again:
  1,984 stations / 5,836 EVSEs, unchanged observation instant
  `2026-10-09T21:52:03.348Z`. Public capacity RPC returns **404 / PGRST202**.
- `android/gradlew.bat app:assembleDebug` — BUILD SUCCESSFUL again in 1m 17s,
  376 tasks (55 executed, 321 up-to-date). Cross-drive hard-link fallback and
  upstream Gradle deprecation warnings; no build failure.
- Real recommendation validation and successful web/Android screenshots are
  **unrun**, because the required endpoint and fresh poll are unavailable.
  Prior synthetic browser checks are not live proof. ADB currently lists no
  device; no new physical or emulator recommendation validation claimed.
- `git diff --check` passed. No commit, routing, ML, ingestion rewrite or TASK-007.

## Provisional checkpoint — 2026-10-10

Reviewed all TASK-006 working-tree changes. Local driver typecheck, zero-warning
lint and all 14 unit/API tests passed again. Committed as a provisional local
implementation checkpoint, not full acceptance. Remote migration, remote SQL,
fresh-data verification and successful Android recommendations remain pending
for hotspot connectivity. No migration deployment or collector execution in this
checkpoint session. Earlier no-commit/no-next-task statements describe prior runs;
the user now authorized this checkpoint and TASK-007 development.

## Hotspot live integration — 2026-10-10

Supersedes prior connectivity/pending-migration notes. Verified TLS DEV connection
and schema check passed. Remote migration history contained only foundation and
map RPC; CLI dry-run listed only `20261010002000_station_capacity_rpc.sql`.
Audited trusted search path, SECURITY DEFINER allowlist, grants, spatial/result
bounds and per-EVSE connector association. Applied unchanged migration to DEV
under the user's existing approval; remote `station_capacity_live.sql` passed,
including actual anonymous denial. Public `verify-map-live.mjs` passed all
pagination/field/bounds/input and five-table read/empty-insert denial checks.

Saved read-only canonical baseline, then executed existing collector exactly
once with capture. Run `125766b8-62ec-45d9-8af0-c3467437558a`: SUCCESS/COMPLETE,
1,984 locations, 5,836 EVSEs, 5,838 connectors, zero duplicate identities,
66 transitions. Independent baseline comparison verified preserved canonical
identities and first-observation timestamps, all observation times advanced,
exact previous/new normalized/source status and timestamp correspondence,
and no transitions for unchanged statuses. Approval is consumed; no second poll.
Observed 03:46:01.044–03:46:04.628 Europe/Vilnius.

Real CCS2 example: Norfa XXL Ateities g. 10 has 0 available, 2 charging compatible
EVSEs; an available Type 2 EVSE is correctly excluded. Alternatives: Jeruzalė
2 available / 0.471 km straight-line, Rimi Jeruzalė 2 / 0.497 km, Baltupių turgus
1 / 0.925 km. The old Spaudos example now has available capacity and was rejected.
Public capacity client returned 846 validated nearby stations. Freshness,
distinct EVSE counts, explanations and stale-data exclusion passed using the
implemented domain policy on public real evidence; stale check used an in-memory
aged copy, never fabricated database observations.

Production Chrome: CCS2 map filter, Norfa selection, primary/two alternatives,
safe unavailable routing, Jeruzalė selection and map recentering passed. No mock
interception. Screenshots and sanitized baseline/poll/recommendation artifacts
are in ignored `services/ingestion/.scratch/`. Android build/export passed;
Pixel_8 exercised the same live journey after cold relaunch: CCS2 filter, Norfa
selection, Type 2 available → CCS2 congestion, primary and both alternatives,
safe unavailable Compare result, then select Jeruzalė and recenter. Connection
required all-interface Metro binding and ADB reverse. First connected launch
produced a Fabric SIGSEGV; next cold relaunch passed. Startup reliability remains
unverified, crash log retained. No physical-device proof. Remote SQL passed again
after poll.

Current driver/server/ingestion TypeScript, driver/server lint, 37 driver tests,
web build, Android export/debug build and diff check passed. Ingestion tests:
13 passed, 1 guarded PostgreSQL suite skipped. No applied migration or collector
source changes. Earlier historical no-routing restrictions were superseded by
the user's current explicit integration scope. TASK-008 remains uncommitted.

## Routing integration follow-through — 2026-10-10

Approved TASK-007 DEV deployment now supplies actual routes to TASK-008. Same
fresh Norfa CCS2 congestion and distinct compatible alternatives verified on
production Chrome and Pixel_8; road-ranked primary Rimi Jeruzalė has 2 available
CCS2 EVSEs and a 163-second / 744-metre estimated drive. Selecting it updates
details and recenters both maps. See TASK-007/008 for route/HTTP/rate-limit evidence.
No second collector poll, migration modification or identity/status write.
The one-poll approval remains consumed. TASK-008 remains uncommitted; native
startup reliability and physical-device validation retain their recorded limits.
