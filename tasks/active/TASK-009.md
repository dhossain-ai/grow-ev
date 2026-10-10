# TASK-009 — Network overview, UI polish and foreground location

Status: Provisional checkpoint `ca6ca98`; visual acceptance incomplete. TASK-010 supersedes the presentation.
Date: 2026-10-10
Prerequisite: routing stability checkpoint `968c567`, separate from TASK-008 `437efee`.

## Scope and implementation

Driver / Network Overview links in the existing Expo Router shell. Shared responsive
React Native dashboard uses existing dark design tokens, desktop paired location
cards, stacked mobile cards, metric tiles, connector controls and coverage notes.
Driver controls, station sheet and freshness presentation are polished; existing congestion, route ranking and recommendation domain rules are preserved.

Read only existing sanitized `get_map_stations` and `get_station_capacity` APIs.
One bounded load on entry or explicit refresh, paginated by existing clients;
nearest central observed station anchors the existing 10.1 km capacity envelope.
Intersect with the explicit study window 25.20–25.36 E, 54.64–54.76 N. Show fetched
map/detail counts and anchor; no administrative city boundary or complete coverage
claim. No migration, collector change, new service or automatic API polling. Expo-compatible `expo-location` is the only added dependency, for explicit native foreground fixes.
A 15-second local clock updates freshness only; it makes no network requests.
Refresh retrieves persisted observations and does not rerun collection.

All displayed totals/pairs use the selected exact connector (CCS2, Type 2, CHAdeMO).
Count distinct canonical EVSEs, never connectors; deduplicate locations. Snapshot
status partition: AVAILABLE, CHARGING, UNKNOWN, other unavailable (BLOCKED,
RESERVED, INOPERATIVE, OUTOFORDER, PLANNED, REMOVED). These are explicit canonical
statuses, not the map's broader aggregate unknown grouping. Keep fresh AVAILABLE
and fresh/stale counts separate; show oldest/newest valid observation times and
fetch time in Europe/Vilnius. Future/invalid observations cannot supply capacity.

Reuse `compatibleCapacity` and `findAlternatives`, including exact compatibility,
60-minute freshness, congestion rules, 10 km straight-line radius and at most
three nearest alternatives per source. Cross-operator classification needs two
nonempty reported names differing after trim/case normalization; absent names
never establish cross-operator evidence. Pairs count options, not independent or
additive spare capacity, actual demand redistribution or measured benefits.

Fresh pairs evaluated at the current clock. If none exist, show separately labeled
dated snapshot patterns evaluated at the newest valid selected observation time;
the same 60-minute policy rejects asynchronously older evidence. Source timestamps
are never changed. Dated pairs do not enter fresh opportunity/congestion counts.
Unknown and outage-only locations never establish congestion. No queues, waiting
drivers, post-charge idling, energy consumption, revenue, ML or predictions.

The concrete pair includes both reported operator names, compatible available EVSE
count, occupied count, geographic distance and evidence explanation. No route calls
or route timestamp substitution. No legitimate fresh route evidence was available
in this pass; driving time stays unavailable and road reachability unverified.

## Actual read-only DEV evidence

Two public RPC requests with existing public configuration, zero TomTom calls.
769 map locations and 769 detailed locations inside the window. Anchor:
`Kintų g. 13 | Vilniaus apšvietimas | Inbalance grid`.
Observation interval: 2026-10-10 03:46:01.044–03:46:04.628 Europe/Vilnius.
All observations stale at this verification; fresh capacity/opportunities zero.

| Connector | Locations | Distinct EVSEs | AVAILABLE | CHARGING | UNKNOWN | Other unavailable | Dated pairs |
|---|---:|---:|---:|---:|---:|---:|---:|
| CCS2 | 140 | 379 | 334 | 12 | 0 | 33 | 12 |
| Type 2 | 684 | 1,434 | 1,127 | 201 | 3 | 103 | 297 |
| CHAdeMO | 44 | 45 | 39 | 1 | 0 | 5 | 3 |

CCS2 featured dated pair: `PLTVILU231_EDLT-66` (Elektrum Lietuva, UAB) →
`IKI Fabijoniškės` (Ignitis, UAB), 6 compatible AVAILABLE EVSEs in the snapshot,
0.209307 km straight-line. Type 2: Smolensko g. 39 / In Balance grid → Eldrive
Lithuania Rimi Mylia 2, 4 compatible AVAILABLE EVSEs, 0.021076 km straight-line.
These are historical observations; not current recommendations or road distances.
Sanitized read-only evidence/helper retained in ignored `services/ingestion/.scratch/`.

## UI polish and foreground location

- Compact Grow EV header and Driver / Network navigation within safe areas;
  one horizontal connector row, expandable power controls, active-filter summary.
- Smaller neutral clusters; stale/invalid/future observations use unverified
  station markers. A local freshness clock makes no additional API requests.
- Collapsed 188px station sheet expands to 62% with scrollable details; attribution
  and the 48px locate control move above it. Primary recommendation remains
  prominent; alternatives are subordinate. Road versus straight-line semantics
  and exact-compatible EVSE policies are unchanged.
- Explicit Locate me obtains one fresh foreground fix. Web requires a secure
  context and browser permission; Android requests coarse/fine foreground
  permission only. No watcher, persistence or automatic permission request.
  Invalid/stale fixes fail closed, valid fixes expire after two minutes or when
  the app backgrounds. Blue dot/white outline and decorative halo are not an
  accuracy measurement. Denial, unavailable services and 15-second timeouts
  are explained. Native requests do not prompt to change device-wide accuracy.
- Route from my location is an explicit opt-in when a fix exists; otherwise
  selected-charger origin and labels are retained. Only lat/lng enter the existing
  routing contract on explicit comparison, not accuracy or the fix timestamp.
- Dashboard foregrounds the existing cross-operator comparison, keeps historical
  evidence explicitly dated, and labels the action Reload saved observations.
  All-stale compatible data says Current availability unverified, with separately
  labeled last-observed counts. Calculations and filters are retained.

## Checks and acceptance limits — final polish pass

From apps/driver:
- npm run typecheck — passed strict TypeScript.
- npm run lint -- --max-warnings 0 — passed with zero findings.
- node --test scripts/*.test.mjs — 58 passed, zero failed/skipped. Includes
  existing congestion/routing/recommendation/network regressions, stale marker
  behavior, invalid fixes, foreground-only requests, browser errors and the
  Android permission-dialog lifecycle regression.
- npm run build:web — passed static production export including /network.
- npx expo export --platform android --output-dir dist/android-check — passed
  JS/Hermes export after final native location request correction.
- android/gradlew.bat app:assembleDebug — BUILD SUCCESSFUL, 6m37s, 376 tasks
  (348 executed, 28 up-to-date). First offline attempt lacked the new Play Services
  location artifact; online assembly downloaded it successfully. Existing
  cross-drive fallback and Gradle deprecation warnings remain.
- git diff --check — passed; changed-source credential-pattern review: zero findings.
- APK installed and exercised on Pixel_8. Merged manifest excludes background
  location and location foreground-service permissions. Native preview uses
  Metro port 8084; production browser preview uses localhost:8082.

Interactive Chrome checks at 390x844 and 1440x1000 passed: map rendering,
clustering, connector/power controls, station selection, collapsed/expanded sheet,
Driver / Network navigation, dashboard connector statistics and stale labels.
Browser permission was explicitly allowed by the user. Simulated coordinates
54.7 N / 25.3 E validate the location dot and recentering; browser unavailable
and timeout messages were observed. Browser denial is deterministic test evidence.

Pixel_8 interaction passed: simulated GPS dot/recentering, actual foreground
permission denial and disabled-services errors, Driver / Network navigation, power-filter indication, station
selection, sheet expansion and user-origin opt-in. Screenshots are under
artifacts/task-009-polish; README.md identifies capture dimensions and limits.
Locations used for these checks are simulator fixtures, not physical GPS evidence.

All current DEV charger observations are stale. Fresh recommendation/provider
comparison from a user origin and physical-device GPS remain unrun; deterministic
routing/selection regressions pass. Zero collector runs, TomTom requests, database
changes or deployments. The earlier intermittent Android Fabric SIGSEGV remains
unresolved; a successful emulator run is not proof of startup reliability.
User visual acceptance remains pending. Initial Comet preview blocking was avoided
by using the authorized Chrome preview, without a security bypass.

## Files

- `apps/driver/src/components/AppNavigation.tsx`, `src/app/_layout.tsx`,
  `src/app/network.tsx`: shared navigation and dashboard route.
- `apps/driver/src/features/network/overview.ts`: pure metrics/pair policy.
- `apps/driver/src/features/network/networkApi.ts`: bounded existing RPC reads.
- `apps/driver/src/features/network/NetworkDashboard.tsx`: responsive shared UI.
- `apps/driver/scripts/network.test.mjs`: domain/API/render regression tests.
- `src/features/location/*`, app configuration and dependency manifests: explicit foreground location.
- `GrowMap.web.tsx`, `GrowMap.native.tsx`, map controls/details/freshness and tests: driver polish.
- `scripts/location.test.mjs`: fix/request/lifecycle regression coverage.
- `docs/STATUS.md`, `PRODUCT.md`, `INTELLIGENCE.md`: actual implementation and limits.

Provisionally checkpointed as `ca6ca98` for TASK-010; no deployment. Modified stability Edge Function still requires
explicit deployment approval. Stop for user visual review of the captured Android/mobile/desktop UI.
