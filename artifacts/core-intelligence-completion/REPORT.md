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

## Authorized CatBoost publication

The previous blocker was GitHub Pro's unavailable deployment reviewers for this
private repository, confirmed in authenticated settings and official GitHub docs.
The owner explicitly approved replacing that requirement for ONE attempt only.
Approval reference: `CORE-INTELLIGENCE-20261011-OWNER-ONE-ATTEMPT`.

AI main: `29b2e4fb67f0b2ba7b32487467d1aee9e20a7ed0`, verified against origin/main.
The first credential-free publication guard requires authenticated actor AND
triggering actor dhossain-ai, manual event, main, attempt 1, exact approved SHA,
canonical poll UUID/reference, enabling flag and pinned model checksum. Environment
allows one branch main and zero tags. Existing TLS, immutable archive/membership,
model, freshness, latest-poll, locks, expiry and publisher checks are preserved.
Only the existing publisher writes; no role/grant/schema/secret/collector changes.
The existing server-side DEV postgres credential remains administrative; this is
not proof of credential-level least privilege. GitHub token remains contents:read.

Single authorized run (succeeded in 42s):
https://github.com/dhossain-ai/grow-ev-ai/actions/runs/38127431753
Job 114434605808. Owner dhossain-ai; verified SHA above; run attempt 1.
Source poll `c97d35c5-9922-4ce7-ae5a-bb968f2ff6b0` was the latest poll at dispatch,
SUCCESS/COMPLETE, verified=true, duplicates=0, no replay; 1984 locations,
5824 source-poll EVSEs, 5826 source-poll connectors. Retained database totals differ
legitimately and immutable archive membership is separately verified by inference.
Read-only preflight 09:09:28 UTC confirmed archived=true, 2445 groups, all fresh.
Cloud preflight 09:11:10 UTC confirmed strict verify-full client TLS/read-only extraction.
Genuine CatBoost availability_v1 generated at 09:11:14.228616 UTC.
SHA256 `c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42`.
Eligible=2445; actual cursor affected rows=2445; rejected=0.
Source observations 08:14:28.185–08:14:32.830 UTC.
Expiry 09:14:28.185–09:14:32.830 UTC (12:14:28–12:14:32 Vilnius).
Read-only postflight 09:15:08 UTC independently confirms 2445 stored matching rows,
correct model/checksum/source UUID and zero unexpired rows.

All FOUR temporary variables were removed immediately after publication:
GROW_EV_ALLOW_PUBLISH, GROW_EV_APPROVED_POLL, GROW_EV_APPROVED_SHA,
GROW_EV_APPROVAL_REFERENCE. Authenticated settings show no environment variables;
main-only restriction and audit history retained. No retries occurred.
Recurring publication stays disabled; scheduled inference remains dry-run.
No retraining or MLP publication was performed.

Public HTTP 200 RPC returned a genuine bounded 12-field prediction for location
`5ba5c7bc-2565-471d-a8c0-ec8b5147cae4`, matching poll/model/checksum and expiry.
Results and Comparison visibly showed Experimental AI Outlook for Opera, CUP and
Santuokų rūmai. Live Opera Details DOM at the expiry boundary showed the matching
Outlook. Details browser viewport was restored to normal during interaction;
its screenshot was captured after expiry and is expiry evidence, not fresh-Outlook
visual evidence. At 09:14:50 UTC the same foreground Details view automatically
removed Outlook; at 09:15:48 UTC the same public RPC returned HTTP 200 [].
No fixture, synthetic prediction or clock override was used.

Evidence JSON/PNG files in this folder contain RPC, route, DOM, screenshots,
pre/postflight, publication log, cleanup and expiry captures. Raw captures remain
local artifacts; tracked reports summarize them without credentials.

## Public release and routing acceptance

Driver deployed release commit: `91a6af6a1aacda2080868a9da2ef854a6db4f98c`.
Deployment: https://github.com/dhossain-ai/grow-ev/actions/runs/38126112204
Cloudflare version: `428c3d19-a9c7-40c5-b0f0-1e44ba2dcada`.
Public asset entry-d44b86910fad66a81381c1a2afb422b0.js matches its job log.
Rollback: `2c226bd0-81ac-40e7-b3fd-a74c38732eaa` (baseline deployment above).
Only grow-ev-demo was deployed through the existing deploy-web workflow.

Fresh public ordinary CCS2 Search genuine HTTP 200 routes:
1440 px, 08:50:39 UTC: Opera→CUP 244 seconds/951m (5 min);
Opera→Santuokų rūmai 346 seconds/1744m (6 min).
390 px, 08:56:44 UTC: respective 245 seconds/951m and 347 seconds/1744m.
1280 px: genuine HTTP 200 and visible 5/6-minute Results and Comparison;
a second fresh session at 09:17:42 UTC returned 249 seconds/951m and
352 seconds/1744m. 320 px repeat at 09:15:59 UTC returned 249 seconds/951m and 352 seconds/1744m; both routes and CUP Details passed.
Initial 320 px session returned a transient HTTP 503 and correctly showed
unavailable; there was no automatic retry. A later fresh manual session passed.
Routes appear prominently in Results/Comparison and on the matching destination
Details with named Opera origin. Origin itself honestly has no destination ETA.
1440/1280/390/320 screenshots were inspected; no horizontal overflow at 320.
Captured successful session console errors: none. Native/device acceptance unrun.

## Checks and final limitations

Driver: npm run typecheck; npm run lint -- --max-warnings 0; npm test
(101 passed); npm run build:web (4 routes): all passed.
AI: python -m pytest -q (60 passed locally and in the publication workflow).
git diff --check passed. Build secret-marker/privileged-JWT scan passed.
Driver infrastructure unchanged; AI changes confined to publication guard,
workflow, actual affected-row audit, tests and approval documentation.

Final status: C. PARTIAL FAILURE, WITH VERIFIED DETAILS.
Both genuine features were visible together publicly, and actual expiry passed.
However, fresh AI Outlook was not visually accepted at 390/320 px before this
single batch expired. Do not claim complete desktop/mobile AI acceptance or A.
No further publication is authorized; another attempt requires new approval.
After expiry there are legitimately no visible fresh forecasts; ordinary routing
continues. No collector, Voice Worker or premium design changes were made.

Final evidence documentation is committed separately with [skip ci] to avoid an unnecessary second web deployment. The deployed code SHA/version above remains the release identity.
