# TASK-003 — Official Lithuanian EV Charging Data Investigation

Status: Complete — verified in investigation and findings
Priority: P0
Owner: Unassigned

## Goal

Verify the public Via Lietuva OCPI data and establish a small, safe foundation
for later ingestion.

## Completed scope

- Fetched and validated the live OCPI locations envelope.
- Added a strict TypeScript investigation script with network and shape errors.
- Added a small representative response fixture, not the full feed.
- Measured Vilnius coverage, statuses, operators, connectors, missing fields and
  timestamp ranges.
- Checked connector capacity semantics and the separate public tariffs endpoint.
- Documented verified findings separately from assumptions and future needs.
- Updated project status.

No map UI, database, migration, ingestion service, marker, recommendation or ML
work was added.

## Verification

2026-10-09:

- `node --experimental-strip-types services/ingestion/scripts/investigate-ocpi.ts`
  — passed against the live endpoint; 93 locations and 64 Vilnius locations.
- `node --experimental-strip-types services/ingestion/scripts/investigate-ocpi.ts --fixture services/ingestion/fixtures/ocpi-locations.sample.json`
  — passed against the saved fixture.
- `apps/driver/node_modules/.bin/tsc.cmd -p services/ingestion/tsconfig.json`
  — passed.
- `npm run typecheck` from `apps/driver` — passed.
- `npm run lint` from `apps/driver` — passed.
- Web build was not required because application files and dependencies did not
  change during TASK-003.
- `git diff --check` — passed.

## Completion summary

The script prints only an aggregate JSON summary. It treats missing data as
missing rather than zero and counts status categories from observed EVSEs.
Findings are a dated snapshot; longitudinal update timing remains unverified.

TASK-003 finalized and committed alongside TASK-004B.

## Coverage verification follow-up — 2026-10-09

Confirmed the original result covered only the first pagination window. Added
bounded explicit-window retrieval, pagination-header reporting, stable operator
identity counts and independent large-window identity-set verification to the
existing script. Added a small PowerShell XML coverage diagnostic for the two
documented DATEX publications; raw datasets are kept in memory only.

Reproduced: OCPI 1,984 locations / 5,824 EVSEs / 13 operator IDs;
Vilnius 888 locations / 2,097 EVSEs / 11 operator IDs. DATEX static 3,672
sites / 18,283 refill-point records / 29 provider names; status 3,706 site
records / 15,749 point statuses. DATEX counts are not verified EVSE capacities.

Checks passed:
- `node services/ingestion/scripts/investigate-ocpi.ts --verify-coverage`
  (repeated; identity sets and structural totals matched).
- `pwsh -NoProfile -File services/ingestion/scripts/investigate-datex.ps1`
  (repeated; structural counts reproduced).
- `node --test services/ingestion/scripts/investigate-ocpi.test.mjs` — 4/4.
- Existing fixture execution and ingestion TypeScript check.
- Existing ESLint configuration applied to the investigation TypeScript and
  test files — passed (React detection warning when invoked from root).
- `git diff --check`.

Remaining gates: advertised-total semantics, differing publication scopes,
DATEX mapping and source timestamp interpretation. Findings retain the earlier
sample explicitly as partial-window evidence. Finalized in Git alongside TASK-004B.
