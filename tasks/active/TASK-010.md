# TASK-010 — Premium Product Experience Redesign

Status: Implemented locally; awaiting user visual review. Uncommitted.
Updated: 2026-10-10

## Scope and checkpoint

TASK-009 was inspected, checked and provisionally committed as `ca6ca98`, with
visual acceptance explicitly incomplete. Its functional integrations were preserved.
TASK-010 implements the supplied Calm Electric light direction on that checkpoint.

## Implemented

- Assistant home: choose one connector, find compatible stations in the fetched map
  window, then select a station. The list is not a global recommendation ranking.
- Existing fresh compatible congestion and nearest-three recommendation policy
  remain authoritative. One primary card leads; alternatives and driving comparison
  are progressively disclosed. Routing remains an explicit action with the original
  origin, expiry, cache, cooldown and eligibility safeguards.
- A shared recommendation card shows compatible capacity, actual driving estimates
  when present, explanation, origin and observation time. Missing routes remain
  unavailable; straight-line distance does not establish road reachability.
- Stale evidence receives a dated empty state. A separate, clearly historical case
  uses four captured station records and three original TomTom summaries. No live
  route request or timestamp refresh occurs in that case. Exploring a recorded station
  exits the case and reads current persisted evidence.
- Light shared tokens, compact secondary Network navigation, interactive Positron
  maps, charging symbols, small clusters, selected rings and neutral stale markers.
- Network Intelligence leads with a two-location cross-operator opportunity;
  metrics, coverage and historical evidence remain subordinate and unchanged.
- Responsive bottom/side panels, scrolling filters, focus states, selected/pressed
  connector semantics, practical touch targets and conservative reduced-motion support.

## Files

Driver presentation: `apps/driver/src/components/`, `features/map/`,
`features/experience/`, `features/network/NetworkDashboard.tsx`, and root layout.
Three evidence-policy tests were added in `scripts/experience.test.mjs`; the network
loading-copy assertion was updated. `docs/DESIGN_SYSTEM.md` records actual tokens,
component hierarchy, motion and layout. `docs/STATUS.md` and TASK-009 record the
checkpoint/review boundary. Screenshots and review: `artifacts/task-010/README.md`.

## Executed verification

From `apps/driver`:

- `npm run typecheck`: passed.
- `npm run lint -- --max-warnings 0`: passed.
- `node --test scripts/*.test.mjs`: 61 passed, 0 failed, 0 skipped.
- `npm run build:web`: production export passed.
- `npx expo export --platform android --output-dir dist/android-check`: passed.
- From `apps/driver/android`, with local Android SDK configured:
  `./gradlew.bat app:assembleDebug --offline`: passed, 1m 11s, 376 tasks.
  Existing Gradle deprecation, SDK XML and cross-drive copy warnings remain.
- Chrome production build: station list/selection, expansion, filters, connector
  states, historical alternatives and exploration, secondary navigation, keyboard
  focus, simulated reduced motion and simulated RPC error exercised. Widths 360,
  390, 768, 1280 and 1440 had no horizontal document overflow.
- Pixel_8: debug APK installed; home, compatible station list, selected details,
  case study and internal scrolling exercised through ADB. Real native screenshots
  retained. This is emulator evidence, not physical-device or startup reliability proof.

The initial test run failed on an obsolete network loading-copy assertion; after
updating that presentation assertion, all 61 passed. Initial Gradle attempts lacked
the correct working directory/SDK setting; corrected final build passed.

## Safety and remaining acceptance

No backend/domain-policy changes, applied migrations, collector run, additional
TomTom requests, Edge deployment, dependencies or TASK-010 commit. Historical replay
tests verify captured ranking/counts/times and stale/origin isolation, not renewed live
availability. Current observations are stale; a fresh live recommendation/route journey
was not run. Physical devices, real GPS, permission-denial runtime, exhaustive assistive
technology and outdoor legibility remain unverified. Previous Android Fabric startup
intermittency is unresolved. A five-second comprehension test with a new driver was
not conducted; screenshots are engineering visual review, not user acceptance.

Next: review the implementation and six required captures. STOP for review; do not
commit TASK-010 or start another task automatically.
