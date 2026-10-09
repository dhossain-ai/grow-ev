# TASK-005 — Real EV Charging Stations on Grow EV Maps

Status: Completed — verified on web and Android emulator
Priority: P0
Updated: 2026-10-10

## Scope and result

Real Lithuanian charging stations from DEV `heafsrqaytsfthfcxmqu` render on
Android MapLibre Native and browser MapLibre GL JS. No collector, routing,
recommendation, scheduling or TASK-006 work was performed. The migration was
already applied by the user; this continuation neither pushed nor edited it.

The initial pre-deployment audit found unsafe RPC configuration. Its reviewed
corrections are now deployed: the live function body matches the repository.

## Security verified

- Both `apps/driver/.env.local` and `services/ingestion/.env.local` exist, are
  Git-ignored, and are untracked. Frontend configuration now contains only the
  public project URL and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The former
  frontend JWT was independently verified to have the `anon` role.
- No database password or privileged key is used in Expo. No credential values
  were printed. All 27 production export files were scanned against the actual
  database password; zero matches. Application request errors exclude raw server
  diagnostics. Verification scripts log counts/results, never headers or keys.
- Deployed RPC is STABLE SECURITY DEFINER with
  `search_path=pg_catalog, pg_temp`. Qualified static read-only query; no dynamic
  SQL, DML, or private metadata. ACL grants EXECUTE to owner, anon and
  authenticated only; no PUBLIC or service_role EXECUTE grant.
- Live catalog checks: all five protected tables have RLS and neither anon nor
  authenticated has SELECT/INSERT/UPDATE/DELETE privileges. Public HTTP GET and
  empty-payload POST to each table return 401. No verification data was inserted.
- Public publishable-key RPC calls succeed without a Bearer JWT. Geographic
  bounds are respected. NULL, NaN, reversed/out-of-range bounds, excessive power
  and oversized connector arrays fail with HTTP 400 / SQLSTATE 22023.
- Reviewed deployed query rejects more than 2,000 stations without truncation.
  This branch was not triggered against real data (1,984 stations); no artificial
  database records were created to exercise it.

## Application corrections

- `api.ts`: guard missing configuration (fixes TS2769); support publishable and
  legacy anon keys using the apikey header; validate data at the API boundary.
- Handle PostgREST's 1,000-row cap with exact Content-Range totals and explicit
  pagination. Reject incomplete/oversized/duplicate or malformed results.
- Remove TASK-005 lint warnings; use scalar effect dependencies without lint
  suppressions. Preserve cancellation/debounce during viewport changes.
- Web source receives station data even when fetching finishes before style load.
- Native clusters use their actual expansion zoom and OpenFreeMap's supported
  Noto Sans font. Map loading failure has visible text.
- Both detail panels have a bounded, scrollable layout. Counts remain EVSE counts,
  not connector counts. Details identify availability as observed and show both
  relative age and the absolute observation timestamp, with STALE when applicable.

## Actual data and UI verification

- National public client: **1,984 stations / 5,836 EVSEs**, retrieved as 1,000 + 984
  records. Vilnius bounds `[25.1, 54.5, 25.5, 54.9]`: **923 stations / 2,207 EVSEs**.
  Bounds coverage differs from the earlier 888-location city-name match.
- Observation time: `2026-10-09T21:52:03.348Z`, equivalent to **2026-10-10 00:52:03
  Europe/Vilnius**. Stored source readings are stale; they are not current physical
  measurements. No simulated charger statuses were published.
- Chrome: development app and final production export at localhost:8082 render
  stations and clusters. Selection, cluster expansion, filters, pan, zoom and
  scrollable details verified. Peteliskiu g. 40: 1/1 available, Type 2, 4 kW,
  timestamp and STALE indicator. Loading, CHAdeMO + 150 kW empty results,
  controlled offline failure and retry recovery verified.
- Pixel_8 emulator: APK installed and launched with the current Metro bundle.
  Initial viewport contains 478 stations. Colored markers, numbered clusters,
  cluster expansion, selection, details scrolling and pan verified. Svitrigailos
  11B ZeroSum: 2/2 available EVSEs, Type 2, 22 kW, timestamp and STALE indicator.
  Loading, empty filters, disabled-network error and restored-network retry passed.
- Emulator initially could not resolve Supabase. Restarting with
  `-dns-server 1.1.1.1,8.8.8.8` fixed resolution. Wi-Fi and data are restored.
  Computer Use connection was unavailable; Android checks used ADB screenshots,
  UI hierarchy and input. Native basemap emits an upstream invalid-line-geometry
  warning. The added cluster font's initial 404 was corrected and not reproduced.
- Screenshots inspected on both platforms. Interactions worked during manual
  testing; no FPS benchmark or physical Android-device test was performed.

## Checks and limits

From `apps/driver`:
- `npm run typecheck` — passed.
- `npm run lint` — passed, zero warnings.
- `node --test scripts/map.test.mjs` — 4 passed, zero failed/skipped. Unit fixtures
  are explicitly synthetic and never sent to DEV.
- `node --env-file=.env.local scripts/verify-map-live.mjs` — passed: actual client
  pagination, counts, bounds, public field allowlist, invalid inputs and anonymous
  table read/insert denial.
- `npm run build:web` — passed; final production export also tested in Chrome.
- `android/gradlew.bat app:assembleDebug` — BUILD SUCCESSFUL, 376 tasks.
- Root `git diff --check` — passed.

The read-only `supabase/tests/map_stations_live.sql` passed against DEV after
fixing the test's polymorphic `array_fill` argument with `::text`. It compared
all station/EVSE category counts to canonical tables and exercised anon denial
and invalid inputs. Deployed security catalog/body checks also succeeded.
Later direct SQL repeats timed out; `supabase db query --linked` stalled while
initializing the login role. These repeats did not pass. Final public HTTP checks
continued to pass. No migration was pushed or changed.

No remaining blocker to the verified web/emulator demo. Physical-device testing,
quantified performance and freshly collected status remain outside this proof.
TASK-005 completed and verified. No next task started automatically.
