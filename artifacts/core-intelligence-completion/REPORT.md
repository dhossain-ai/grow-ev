# Core intelligence completion — release evidence

## Scope and baseline

Public application: https://grow-ev-demo.dhossain.workers.dev/
Remote driver main verified `670a0eaca20289a8484d8c6797877159d6fe27aa`;
remote AI main `36274546c330cc36c2391eb1fb076cbed92ebf1b`.
Public baseline script `entry-d0cd9e97b0524872b0e90c0f941365e1.js` matches
deployment 38116394331 (code 142090f). Its authenticated job log verifies
Cloudflare version `2c226bd0-81ac-40e7-b3fd-a74c38732eaa`; retain as rollback.
Focused driver branch: `fix/core-intelligence-completion` from latest main.

## TomTom root cause and correction

Actual ordinary public journey: CCS2 → Find charging options → Results →
Compare alternatives displayed Opera, CUP and Santuokų rūmai with unavailable
driving times. Neither action initiated routing. Only a separate Compare driving
times action requested routes. Results originally showed only the origin charger;
the destination estimates remained elsewhere. Origin captions did not name Opera.

Web Search now requests one bounded route batch after compatible evidence loads.
The homepage identifies charger-origin comparisons before the action. Results
names the actual origin, explicitly distinguishes it from driver position, shows
actual destination minutes prominently near the top, and exposes destination
cards. Comparison reuses valid routes and requests missing estimates. Details
retains the exact destination route and named origin. Cards emphasize minutes
and show subtle routing progress. Errors/expired/invalid routes remain unavailable.
No automatic geolocation, inferred driver location, ranking/connector changes or
new framework. Native search still requires its existing explicit route action.
The shared routing client retains exact-coordinate validation, cache, deduplication,
partial results, cooldown and the maximum of three destinations.

Changed source: `ExperiencePanel.tsx`, `useDriverSearch.ts`,
`PremiumStationCard.tsx`, `PremiumStationDetails.tsx`, all under
`apps/driver/src/features/experience/`; regression tests in
`apps/driver/scripts/premium-experience.test.mjs`.

Local production-export ordinary Search HTTP 200 on 2026-10-11T08:43:51Z:
Opera (54.68852,25.278455) → CUP (54.693937,25.274845), 243 seconds/951m,
displayed 5 minutes; → Santuokų rūmai (54.682287,25.268939), 345 seconds/1744m,
displayed 6 minutes. These are local browser integration evidence, not public
release acceptance. No fixture responses were used. The origin is a real charger,
not a claim about the tester's position.

## CatBoost approval and data evidence

Authenticated account billing verifies GitHub Pro; AI repository is private.
Only `prediction-dry-run` exists. Its editor offers branch/tag restrictions,
secrets/variables, but no required reviewer control. Repository variables and
environment variables are empty. Repository secrets by NAME:
`GROW_EV_DATABASE_URL`, `GROW_EV_DATABASE_CA`; values were not inspected.
Owner `dhossain-ai` can view repository settings and manual workflow controls.
The mandatory reviewer requirement is README.md's explicit publication policy;
there is no supported reviewer environment configured on this private Pro repo.
[GitHub's documented limitation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments).

The exact blocker is a private-repository GitHub plan limitation plus an
unapproved replacement of the mandatory reviewer policy, not a failed model,
missing named database secret or failed inference. `prediction-publication`
and its enabling variable are absent. Do not create them unprotected implicitly.
The concrete supported owner-only one-publication alternative and exact UI
instructions are in `PUBLICATION-APPROVAL.md`; explicit approval was requested.
No answer/approval is inferred from elapsed time. AI code/settings stay unchanged.
The connection validator currently only accepts postgres; least-privilege
credential provisioning would require a separately reviewed role/secret change.

Latest genuine completed cloud inference inspected:
https://github.com/dhossain-ai/grow-ev-ai/actions/runs/38124172790
Code 3627454; dry-run; 2445 records; real_catboost_inference=true;
database_writes=false; model availability_v1. SHA256 verified locally:
`c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42`.
No retraining or MLP publication.

Read-only repeatable-read DEV SQL audit, 2026-10-11T08:39:13.935028Z:
poll `c97d35c5-9922-4ce7-ae5a-bb968f2ff6b0`, start 08:14:25.896876Z,
completion 08:15:25.407362Z; SUCCESS/COMPLETE, verified=true, duplicates=0,
no replay; 1984 locations/5824 EVSEs/5826 connectors. Current-poll compatible
groups=2445, fresh eligible=2445, stale=0, future=0. Observation range
08:14:28.185–08:14:32.830Z; corresponding expiry 09:14:28.185–09:14:32.830Z.
This count is timestamped evidence and must be revalidated before publication.
The cloud extraction/inference path validates immutable archive membership;
the SQL group count alone is not an independent decoded-archive certification.
Published rows=0; no publication run or insert count exists.

Supabase table RLS=true; anon/authenticated INSERT=false; bounded public RPC
EXECUTE=true. Existing publisher uses approval flag, transaction plus collector
advisory locks, latest genuine verified poll recheck, validated fixed fields and
ON CONFLICT DO NOTHING. Expiry derives from observation time. No schema, ACL,
collector or publication changes were applied.

Driver Outlook contract inspected: exact station/connector/model/checksum,
source timestamp matching, bounded RPC, cancellation and expiry removal remain.
Missing rows legitimately hide Outlook. Genuine visible Outlook and production
expiry acceptance are unrun while publication remains blocked; synthetic tests
are not production evidence. Recurring publication stays disabled; existing
hourly collector/archive/inference dry-run chain is preserved.

## Checks

Executed final driver TypeScript, `npm run lint -- --max-warnings 0`, all
`npm test` (101 passed), and `npm run build:web` (4 static routes): passed.
AI `.venv/Scripts/python.exe -m pytest -q`: 42 passed.
`git diff --check`: passed. Infrastructure trees and AI tracked files unchanged.
Built JS scan: no server-secret markers or privileged-role JWTs detected;
public Supabase configuration is intentionally bundled. No credential values
were printed. Earlier callback lint failure and an overlapping export EEXIST
were resolved; final clean checks passed. Export's NO_COLOR notice is unrelated
to application lint warnings. Final public release evidence follows below.
