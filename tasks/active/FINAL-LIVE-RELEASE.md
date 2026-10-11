# Final AI Outlook and TomTom live release — 2026-10-11

Status: frontend verified locally; production deployment pending. AI publication
blocked by the required protected approval environment, not data freshness.

Scope: the user's final pre-pitch release request. Preserve TASK-015 collection,
archive, hourly schedule, Voice Worker, premium layout and recommendation ranking.

## Verified findings

Driver remote main: `9a27cde8ac6c4c8f4183e54c424f0fb8490f4897`.
AI remote main: `36274546c330cc36c2391eb1fb076cbed92ebf1b`.
Cloudflare active baseline: `81d69b9d-b1d8-4d36-8517-a3b209dcfd71`.

Latest genuine inference [38114248474](https://github.com/dhossain-ai/grow-ev-ai/actions/runs/38114248474)
inferred 2,445 records in dry-run from poll
`cdcff5c1-2d8d-4888-b630-79d5d8f5a186`. Read-only SQL at 05:48:31 UTC
confirmed all 2,445 source groups younger than one hour, zero stale/future groups,
source times 05:14:28.526–05:14:32.422 UTC and zero published rows.
CatBoost `availability_v1` checksum:
`c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42`.
No timestamp substitution, model retraining or publication occurred.

The deployed prediction table has RLS and denies public insert/update access.
The actual RPC matches the reviewed migration: bounded exact station/connector
read, trusted search path, qualified tables, valid expiry and latest-poll gate.
Public Opera/CCS2 RPC returns HTTP 200 and `[]`; no outlook is fabricated.

The AI README explicitly requires environment reviewers before setting
`GROW_EV_ALLOW_PUBLISH=approved`. GitHub currently lists only `prediction-dry-run`;
`prediction-publication` is absent and required-reviewer controls are unavailable.
[GitHub documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments)
limits these controls on Pro private repositories. No unprotected environment,
approval variable, publication dispatch or automatic publication was enabled.
Resolve the reviewer gate without bypassing it before first publication.

## Minimal frontend change

Real public TomTom HTTP 200 responses already work without a congestion event.
The misleading path fetched alternative routes while leaving Results on the
origin charger, where a drive-to-self route is correctly excluded. The button
now opens Comparison so returned destination estimates are visible immediately.
User-origin Results and Details already show valid returned routes.

The existing outlook now says "Experimental AI Outlook" and displays source
time, expiry and model identity. Exact identity/checksum/freshness/observation
matching, missing-data hiding, cancellation and expiry behavior are preserved.

## Checks

After restoring dependencies with the unchanged package lock: driver TypeScript,
`npm run lint -- --max-warnings 0`, 96 driver tests and production web export pass.
AI `python -m pytest -q`: 42 passed. `git diff --check` passes.
Initial checks failed on incomplete installed dependencies; `npm ci` initially
hit a native DLL held by the main development server. That specific server was
stopped; the unrelated TASK-016 server was preserved. Final locked install passed.
A broad `eslint .` also scanned generated MapLibre vendor code; the project's
Expo lint command passes with zero warnings. No dependency files changed.

## Acceptance remaining

Deploy through the single existing web workflow, verify real fresh public desktop
1440/1280 and mobile 390/320 CSS-pixel loads, and record deployment evidence.
AI visibility and one subsequent automatic publication cycle cannot pass while
the required reviewer gate remains unavailable. Do not claim full release success.
Physical-device and spoken-command acceptance are outside this web validation.

See `artifacts/final-live-release/REPORT.md` for route and release evidence.
