# Grow EV — Current Project Status

Updated: 2026-10-10
Phase: TASK-007 local implementation; live verification deferred to hotspot

## Verified foundation

- TASK-001 through TASK-005 completed: Expo SDK 57 / strict TypeScript,
  universal MapLibre, Via Lietuva investigation, Supabase/PostGIS foundation,
  one-shot collector and real-data map.
- Earlier verified DEV collection: 1,984 locations, 5,836 EVSEs, 5,838 connectors;
  canonical identities and unchanged-status nontransitions preserved.
- Earlier Chrome/Pixel_8 map verification and Android debug build passed.
  Physical-device validation remains unverified.

## Current work

- TASK-006 locally implemented and provisionally committed as `95764d1`.
  Reviewed all changed/staged files; no secrets included. Current checkpoint
  typecheck, zero-warning lint and all 14 unit/API tests passed.
  Remote capacity migration, remote SQL, fresh-data verification and successful
  Android recommendations remain pending. This is not full TASK-006 acceptance.
- TASK-007 typed routing contract, server-side TomTom adapter/Edge endpoint,
  bounded requests and shared web/Android shortlist comparison implemented locally.
  Explicit comparisons originate at the selected station, retain geographic
  shortlist order and distinguish road distance from straight-line distance.
  Missing routing displays "Driving time unavailable". Live routing unverified.
  See `tasks/active/TASK-007.md` for checks, API budgets and pending acceptance.
- TASK-007 remains uncommitted and undeployed, stopped for review.

## Connectivity and live gates

- University eduroam blocks Supabase database connectivity. Do not repeatedly
  troubleshoot; remote checks await hotspot connectivity.
- No migrations, collector executions or live provider calls in this session.
- Existing observations (`2026-10-09T21:52:03.348Z`, 00:52:03 Europe/Vilnius) were
  stale at prior verification. New capacity RPC remains undeployed.
- TASK-006's earlier conditional remote approval did not result in deployment
  or consume the one-poll allowance. This session explicitly forbids migration
  deployment and collector changes; review future live actions separately.
- TomTom credentials remain server-side. Deno runtime/deployment, live traffic
  routing, provider quotas/coverage/licensing and live web/Android UI unverified.
- Edge endpoint budgets apply per isolate; distributed public abuse protection
  and provider spending caps are still required before public rollout.

## Deferred product scope

Scheduled ingestion, historical analytics, dashboard, ML, pricing, waiting-time
predictions and public deployment remain outside the implemented slice.

## Dependency findings

Earlier driver audit reported 29 transitive advisories (10 moderate, 19 high)
upstream of Expo SDK 57. No dependencies changed in TASK-006/007; audit not rerun.

## Latest local verification

TASK-007 final results are recorded in its active task file. These checks use
fixtures and mocks; they do not establish live traffic routing or fresh capacity.

## Next

Review TASK-007. Then use hotspot connectivity for separately authorized live
verification. Do not start another task automatically.

Final TASK-007 checks (2026-10-10): driver and server/shared TypeScript passed;
driver and server/shared lint passed with zero lint warnings/errors; 24 unit/API
tests passed with zero failures/skips. Web production export, Android JS/Hermes
export and offline Android debug build passed. Initial import/lint configuration
and shared-module Metro failures were corrected; final checks pass. Diff check
passed; generated web JS excludes TomTom secret name and provider URL. Deno runtime,
live provider/endpoint and platform interactions remain unrun. No remote writes,
collector changes or TASK-007 commit. Full commands in the active task file.

TASK-007 checkpoint review (2026-10-10): explicit charger-to-charger labels,
frontend credential exclusion, error-to-unavailable handling and request budgets
reviewed. Driver/server TypeScript, zero-warning lint, all 24 tests and web build
passed again. Provisionally checkpointed; live verification remains pending.
TASK-008 deterministic recommendations now authorized; no live calls/deployment.
