# Grow EV — Current Project Status

Updated: 2026-10-10
Phase: Lithuanian charging data ingestion verified and completed

IMPORTANT:
This is the initial status document.
No implementation is marked complete without verification.

## Confirmed product direction

Grow EV addresses Hack4Vilnius Challenge #13:
Efficient and responsible use of EV charging infrastructure.

Product components:
- Driver app
- Browser demo
- Network/operator dashboard
- Shared intelligence engine

## Chosen technical direction

- Expo / React Native / TypeScript
- Native and web MapLibre implementations
- Supabase PostgreSQL + PostGIS
- TypeScript application services
- Python for analysis and ML
- Cloudflare web hosting candidate
- TomTom traffic-aware routing candidate

## Verified completed work

- TASK-001 project foundation and final cleanup.
- Expo SDK 57 driver application in `apps/driver`.
- Single Git repository initialized at project root (`E:\Grow EV`) with comprehensive root `.gitignore`.
- Expo Router with one minimal universal home screen.
- Strict TypeScript, ESLint and npm scripts.
- Typecheck, lint, Expo Doctor and production web export pass.
- Browser smoke test renders the Grow EV home screen without console errors.
- Android debug build (`app-debug.apk`) generated, installed, and verified running on Pixel_8 emulator.
- TASK-002 cross-platform MapLibre foundation.
- Native Android and browser maps render OpenFreeMap Liberty centered on Vilnius.
- Pan, zoom and attribution verified on Pixel_8 and in the browser.
- TASK-003 Via Lietuva OCPI investigation verified and completed.
- TASK-004B one-shot collector verified and completed on Supabase DEV: two complete polls,
  1,984 locations, 5,836 EVSEs, 5,838 connectors, zero duplicate canonical
  entities and zero false transitions. Real-transition/failure/interruption tests
  passed locally; no simulated status changes were written to DEV.
- TASK-004A cloud database foundation verified on the user-confirmed disposable
  Supabase project: migration applied, five tables/RLS verified, rollback-only
  SQL suite passed twice on PostgreSQL 17.11 / PostGIS 3.3.7.
- Live locations response structure, Vilnius coverage, statuses, identifiers,
  timestamps and tariff references documented in `docs/OCPI_FINDINGS.md`.
- Small TypeScript investigation script and representative fixture added.
- Coverage correction: the original 93 locations were the first source window.
  Full OCPI scan verified 1,984 locations, 5,824 EVSEs and 13 stable operator
  IDs; Vilnius city match has 888 locations, 2,097 EVSEs and 11 operators.
- DATEX static publication verified 3,672 sites and 29 provider names;
  its point/connector counts are not yet mapped to independent EVSE capacity.

## Work not yet verified as complete

- Scheduled ingestion
- Historical occupancy/analytics processing
- Routing integration
- Recommendation engine
- Dashboard
- Driver charging features
- Public deployment
- Driver/dashboard automated testing

Do not assume these have been implemented.

## Immediate next tasks

1. Review product and architecture documents.
2. Create repository structure.
3. Define the next scoped driver-app task.
4. Verify charger feed structure, access and licensing.
5. Verify routing provider access and quotas.
6. Implement database schema.
7. Implement ingestion and validation.
8. Implement network analysis.
9. Implement initial recommendation engine.
10. Connect the driver UI and network dashboard.
11. Test with real data and documented scenarios.
12. Prepare live and fallback demo modes.

## Critical technical risks

- Missing or stale charger status.
- No historical data at project start.
- Different operator data quality.
- Tariffs may be incomplete or complex.
- Public data may not expose actual charging completion.
- Free API and hosting quotas.
- Native/web map differences.
- Traffic routing availability.
- Predictions without enough evaluation data.

## Current task

TASK-003 and TASK-004B verified and completed. Next task: TASK-005 (network
analytics and status-history processing). See `tasks/active/TASK-004B.md`.

## Current blockers

- Local PostgreSQL 16.15 / PostGIS 3.4.2 now available in WSL for disposable tests.
- No TASK-004B verification blocker. Server-side environment is configured and
  ignored; TLS uses the official CA and the confirmed DEV session pooler.
- Production ingestion needs clarification of OCPI advertised-count semantics
  and DATEX entity mapping/publication scope. Source timestamp timezone and
  longitudinal update timing also remain unresolved. See `OCPI_FINDINGS.md`.

## Unresolved dependency audit findings

- `npm audit` in `apps/driver` reports 29 transitive vulnerabilities (10 moderate, 19 high)
  in upstream Metro/Expo packages (`braces`, `decode-uri-component`, `node-forge`, `uuid`).
  These are upstream to Expo SDK 57 / React Native 0.86; force-fixing would break SDK 57 compatibility.

## Latest verification

TASK-004B (2026-10-10): both approved DEV runs passed on user-confirmed
heafsrqaytsfthfcxmqu. First live fetch/stored counts: 1,984 locations, 5,836 EVSEs,
5,838 connectors, one SUCCESS/COMPLETE poll, zero baseline transitions. Exact
captured-source replay: same entity counts, two SUCCESS/COMPLETE polls overall,
zero transitions. Full-row/identity comparison passed: no canonical duplicates,
UUID/first-observation changes, source-field corruption or partial publication.
95 duplicated public EVSE-ID groups and 30 UNKNOWN EVSEs preserved correctly.
Local parser and PostgreSQL tests rerun: 23 passed, zero failed/skipped.
Ingestion TypeScript, read-only schema/TLS check and diff checks passed.
Connection formatting/IPv6/CA setup corrected privately; no credential printed.
No schema, app, scheduling or new feature changes. TASK-003 and TASK-004B finalized in Git.
See tasks/active/TASK-004B.md for poll IDs, commands and verification details.

TASK-004A (2026-10-10): Supabase CLI 2.106.0 initialized and authenticated;
user confirmed disposable project `heafsrqaytsfthfcxmqu`. Empty-target preflight
and dry-run passed; explicitly approved `db push --yes` applied migration
`20261009000100`. PostgreSQL 17.11 / PostGIS 3.3.7 verified. Complete SQL suite
passed twice via `db query --linked --file` after removing psql meta-commands
in a temporary transport copy. Actual anon/authenticated ACL denial and
default-deny RLS tested. Post-test counts were zero for all five tables and
temporary SELECT grants rolled back. `git diff --check` passed.
No application files/dependencies changed; application checks not rerun.
Remote migration-history SQL matches the repository (31 statements, normalized
whitespace/comments). TASK-004A finalized in Git; no remote reset.

2026-10-09, from `apps/driver`:
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx expo-doctor` — 21/21 checks passed.
- `npm run build:web` — passed; static export generated.
- Browser smoke test — passed at the local Expo web URL with no console errors.
- Android native build & launch — `./gradlew app:assembleDebug` passed, APK installed and verified rendering on `Pixel_8` emulator.
- Root repository — single Git root initialized at `E:\Grow EV`, `.gitignore` correctly ignores build artifacts, local properties, secrets, and IDE files while preserving `package-lock.json`.
- `npm audit` — 29 transitive advisories documented above.
- TASK-002 `npm run typecheck` and `npm run lint` — passed.
- TASK-002 `npx expo-doctor` — 21/21 checks passed.
- TASK-002 `npm run build:web` — passed with MapLibre CSS and worker assets.
- TASK-002 Android — debug build installed and rendered on `Pixel_8`; pan,
  double-tap zoom and full attribution dialog verified.
- TASK-002 web — rendered in browser; pointer pan, zoom control, attribution
  links and a clean console in a fresh session verified.
- TASK-003 full coverage investigation — passed; four explicit OCPI windows
  and an independent large-window fetch returned the same 1,984 unique location
  identities. Default 93-location response was a partial window.
- OCPI national and Vilnius counts reproduced; both DATEX publications counted
  using the platform XML parser without saving raw feeds.
- Pagination regression tests — 4/4 passed (empty intermediate window,
  duplicate identities, changing total and missing total).
- TASK-003 ingestion-script TypeScript check — passed.
- Driver typecheck and lint after TASK-003 — passed; application code and
  dependencies were unchanged, so the web build was not rerun.

## Handoff rules

After meaningful implementation:
- Update completed work.
- List active tasks.
- List current blockers.
- Record verified test results.
- Reference relevant task files and commits.

Keep this document short and current.

Do not use it as an endless development diary.
