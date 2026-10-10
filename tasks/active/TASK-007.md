# TASK-007 — Traffic-aware routing

Status: Locally implemented and offline verified; provisional checkpoint authorized. Live acceptance pending.
Date: 2026-10-10

## Scope

Prepare TomTom road-driving estimates for the existing compatible shortlist.
No migrations, collector changes, ML, pricing, dependencies or deployment.
TASK-006 provisional checkpoint: `95764d1`; not fully verified.

## Implementation and decisions

- One shared typed contract in `packages/routing/index.ts`: WGS84 origin and
  destination, duration seconds, road meters, traffic-awareness, provider and
  UTC calculation time. Both clients use the same endpoint and validation.
- Supabase Edge Function `routing`: POST origin plus 1–3 unique destinations,
  each within 15 km geographic distance. JSON body maximum 2048 bytes with a
  two-second read deadline. Per-result errors preserve partial successes/order.
- TomTom v1 Calculate Route requests car/fastest, `traffic=true`, `departAt=now`,
  `computeTravelTimeFor=all`, `summaryOnly`, no alternative route geometry.
  Primary `travelTimeInSeconds` is retained; free-flow duration is not substituted.
  Live-traffic summary field must be present to advertise traffic-awareness;
  this flag means available traffic was requested, not proven sensor coverage.
- Eight-second provider deadline, sanitized failures, no automatic retries.
  Missing credentials: 503; timeout: 504; provider errors: 502; rate limits: 429.
  Credentials, raw provider bodies and request URLs are never returned/logged.
- Set `TOMTOM_API_KEY` only as a server-side Edge Function secret. No TomTom key
  in Expo configuration or any `EXPO_PUBLIC` variable. Existing public Supabase
  URL/key resolve the endpoint. No privileged database access is needed.
- Public guest function (`verify_jwt=false`) with CORS for web/native clients.
  Local isolate budget: 30 destination calls/minute, two concurrent batches,
  and 60-second backoff after provider 429. This is not a deployment-wide quota;
  shared gateway limits/provider spending caps are required before public rollout.
- Shared details UI requests only on explicit "Compare driving times", for at
  most three candidates already vetted by TASK-006. Panning, zooming and freshness
  timer ticks do not request routes. Successful comparisons reused for two minutes;
  stale results withheld; requests cancel on shortlist/station change/unmount.
- Origin is explicitly the selected charger, not an inferred driver position.
  Geographic shortlist ranking remains unchanged; UI compares estimated duration
  and road distance alongside separately labeled straight-line distance. Failed,
  missing, expired or unrequested routing shows "Driving time unavailable".
  Availability is not predicted for arrival; no total journey/wait time invented.

## Offline verification

Controlled synthetic fixtures and mocked HTTP only; no live TomTom request.
Commands and final results recorded after execution below.

## Pending hotspot/live acceptance

- Deno/Supabase Edge runtime packaging and live endpoint deployment unrun.
- Configure a server secret privately; verify live TomTom authorization, traffic
  response semantics/coverage, quotas, licensing and error behavior on hotspot.
- TASK-006 remote migration, remote SQL, fresh-data and successful Android
  recommendations remain pending. No database networking retried here.
- Verify real fresh compatible shortlist and routing on web and Android after
  separate deployment authorization. Native build is not interaction/live proof.
- Review origin-location UX and distributed abuse controls before public rollout.

Prior review stop lifted by the user's authorization to checkpoint TASK-007.

## Executed final checks — 2026-10-10

From `apps/driver`, unless specified:

- `npm run typecheck` — passed.
- `npm run lint -- --max-warnings 0` — passed, zero lint warnings/errors.
- `node ./node_modules/typescript/bin/tsc -p ../../supabase/functions/tsconfig.json`
  — passed (server/shared/index entrypoint with minimal Deno runtime declaration).
- From root: `./apps/driver/node_modules/.bin/eslint supabase/functions packages/routing --config eslint.config.cjs --max-warnings 0`
  — passed, zero lint warnings/errors. Expo's React autodetection emits an
  informational fallback message because this lint runs from the root.
- `node --test scripts/map.test.mjs scripts/congestion.test.mjs scripts/routing.test.mjs`
  — 24 passed, zero failures/skips, including 10 new routing tests. Controlled
  fixtures cover normalization, traffic/free-flow distinction, coordinate/radius/
  candidate bounds, missing credentials, timeout, HTTP errors/429, malformed
  payloads, geographic/road distance, partial success/order, CORS/body limits,
  request budget/backoff/concurrency, client association/age/error validation,
  and integration with compatible/fresh top-three candidate selection.
- `npm run build:web` — passed, production static export in ignored `dist`.
- `npx expo export --platform android --output-dir dist/android-check` — passed,
  native JS/Hermes bundle includes shared routing/UI; ignored artifacts.
- From `apps/driver/android`: `./gradlew.bat app:assembleDebug --offline` —
  BUILD SUCCESSFUL, 376 tasks (55 executed, 321 up-to-date). Known cross-drive
  hard-link copy fallback and Gradle deprecation warnings; no build failure.
- `git diff --check` — passed. Generated web JS contains neither
  `TOMTOM_API_KEY` nor `api.tomtom.com`; provider adapter remains outside Expo.
- Initial lint had import-order warnings and external-config path failure;
  corrected imports and root lint config, final commands pass. Initial web build
  could not see the shared package; narrow Metro watch folder fixed it and both
  web/native exports pass. No dependency added.
- Unrun: live TomTom, live Edge endpoint, Deno runtime check (Deno not installed),
  successful UI interactions on browser/emulator/device, remote SQL/migrations,
  fresh collection. Local SQL from TASK-006 was not rerun in this session;
  its prior local results remain in TASK-006. Debug APK is not live routing proof.

## Changed files

- `packages/routing/index.ts`: shared contract/validation/geographic distance;
  existing `congestion.ts` delegates its geography calculation to avoid duplication.
- `supabase/functions/routing/{index,handler,tomtom}.ts`: server entrypoint,
  bounded endpoint and provider adapter; server `tsconfig.json`/`runtime.d.ts` for
  local checks; `supabase/config.toml` records guest function JWT configuration.
- Driver `routingApi.ts`, `AlternativeRouting.tsx`, `CongestionDetail.tsx`:
  validated client and explicit shared shortlist comparison.
- `routing.test.mjs`, updated `congestion.test.mjs`: fixture-only regressions.
- Driver `metro.config.js` and root `eslint.config.cjs`: shared-source visibility
  and lint coverage using existing dependencies.
- `docs/API.md`, `ARCHITECTURE.md`, `INTELLIGENCE.md`, `STATUS.md`, this task:
  implemented contracts, decisions, current checks and live limitations.

Final status: locally implemented and offline verified; live acceptance pending.
No deployment. The user subsequently authorized a provisional checkpoint and TASK-008.

## Provisional checkpoint review — 2026-10-10

Reviewed implementation and all uncommitted TASK-007 files. Strengthened both
route heading and duration labels to explicitly say charger-to-charger travel.
No driver-origin ETA claims. Provider failures cannot supply a numeric ETA;
malformed/mismatched/expired responses are rejected. Frontend source and generated
web JS exclude the TomTom secret name/provider host and privileged credentials.
The existing public Supabase URL/publishable key are intentional client config.

Request input/body/radius/candidate, concurrency and minute budgets plus provider
backoff are covered by mocks. Budgets remain per isolate, not a global spending
cap; distributed controls are still required before public deployment.

Rerun: driver and server/shared TypeScript, driver/server lint, all 24 unit/API
tests, production web build and diff checks passed. No live API calls, deployment,
migration/collector changes. Earlier Android compile/export results retained;
no new runtime/device claim. Live TomTom/Edge/platform verification awaits hotspot.
TASK-007 is now a provisional local checkpoint, not full live acceptance.
