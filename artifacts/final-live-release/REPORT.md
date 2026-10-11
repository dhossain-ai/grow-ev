# Final live release evidence — 2026-10-11

## AI

Latest verified poll: `cdcff5c1-2d8d-4888-b630-79d5d8f5a186`, SUCCESS/COMPLETE,
zero duplicates, genuine verified membership. Completed 05:16:06.690144 UTC.
Source observations: 05:14:28.526–05:14:32.422 UTC.
Inference: [38114248474](https://github.com/dhossain-ai/grow-ev-ai/actions/runs/38114248474),
AI commit `36274546c330cc36c2391eb1fb076cbed92ebf1b`.
Model: `availability_v1`, SHA-256
`c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42`.
Inferred 2,445; eligible at the 05:48:31 UTC read-only audit 2,445;
stale 0; future 0; identity/expiry rejections in the successful inference 0.
Final read-only recheck at 06:06:05.819612 UTC confirms the same latest poll,
2,445 eligible groups, zero stale/future groups and zero published rows.
Publication remains blocked by the missing reviewer-protected environment.
Published count 0; protected publication run URL none; actual station displaying
AI Outlook none. Automatic publication remains disabled; collector chaining
continues using its existing dry-run mode. No MLP publication.

The live RPC has exact identity, latest-poll, real source time and expiry guards.
Its private table has RLS, denies anon/authenticated INSERT and anon UPDATE, and
uses bounded read-only SECURITY DEFINER execution with pg_catalog/pg_temp search
path and qualified tables. Public Opera/CCS2 request returns HTTP 200 with `[]`.
Candidate Opera ID `2c1f0bcd-f96a-4d04-87ea-b5051aa40432`;
connector `IEC_62196_T2_COMBO`. No published expiry exists. Source-derived
eligibility ends around 06:14:28–06:14:32 UTC; inference generation cannot extend it.

The missing environment is `prediction-publication`; only `prediction-dry-run`
exists. AI README requires reviewers before its approval variable is set.
The current private repository exposes no required-reviewer controls; GitHub
documents this restriction for Pro private repositories.
See [the official protection documentation](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments).
No unprotected replacement or paid-account change was made.

## Genuine TomTom responses on the public app

The controlled test origin is an explicit browser geolocation override,
54.6872, 25.2797 in Vilnius; it is not a physical GPS observation. The provider
routes are genuine HTTP 200 responses from the production Supabase routing proxy.

| Destination | Identity | Duration | Road distance | Provider calculation UTC | UI minutes |
| --- | --- | --- | --- | --- | --- |
| Opera | `2c1f0bcd-f96a-4d04-87ea-b5051aa40432` | 69 s | 213 m | 05:50:22.457 | 2 |
| CUP | `59b19f61-a8cf-4b66-9ac0-ecef31b4a922` | 193 s | 979 m | 05:50:22.457 | 4 |
| Santuokų rūmai | `5ba5c7bc-2565-471d-a8c0-ec8b5147cae4` | 246 s | 1,531 m | 05:50:22.457 | 5 |

UI uses ceiling minutes; 2 min is the actual 69-second provider route rounded
up. Traffic-aware flag is true. Coordinates, timestamps, distance and duration
were read from the real network response. No API key is recorded.

A separate selected-charger-origin batch from Opera returned CUP 214 s/951 m
and Santuokų rūmai 315 s/1,744 m at 05:41:51.714–05:41:51.716 UTC, also HTTP 200.
Those routes appeared as 4 and 6 min on Comparison. Results remained on Opera
with "Driving time unavailable": it was the request origin, not a destination.
The fix opens Comparison when the driving comparison button is pressed.
Existing cache, rate-limit/cooldown, exact-origin and two-minute age guards remain.

## Release preflight

Focused branch `fix/live-ai-outlook-tomtom` starts at remote main `9a27cde8`.
Changes: ExperiencePanel button transition; PredictionOutlook label/source/expiry/
model captions; premium-experience regression tests; task/status/evidence docs.
No ranking, collector, schedule, schema, archive-pruning or Voice Worker changes.

Passed: TypeScript; project ESLint with zero warnings; all 96 driver tests;
42 AI tests; production web export; diff whitespace check.
Initial local checks/install failures were resolved before this release.
Local credentials failed connection; read-only SQL used the authenticated exact
Supabase project instead. Credentials were neither inspected nor printed.

Baseline production deployment:
[38103258594](https://github.com/dhossain-ai/grow-ev/actions/runs/38103258594),
Cloudflare `81d69b9d-b1d8-4d36-8517-a3b209dcfd71`.
Immediate rollback target: that verified premium baseline.
Earlier stable rollback: `40f44261-6217-459b-811c-0120353e7f4b`.
New production code commit: `142090f27697be401a6eb910a2f9170252a42edc`.
Deployment: [38116394331](https://github.com/dhossain-ai/grow-ev/actions/runs/38116394331),
completed successfully. Cloudflare version `2c226bd0-81ac-40e7-b3fd-a74c38732eaa`.
Only one deployment was launched; documentation follow-up uses `[skip ci]`.

## Post-deployment public acceptance

Fresh actual public loads were measured at 1440x1000, 1280x900, 390x844 and
320x700 CSS pixels. Scroll width equals viewport width in all four cases.
Chrome's existing 50% zoom required checking actual CSS dimensions rather than
trusting screenshot pixel size. Desktop and mobile layouts were visually reviewed;
temporary viewport/geolocation overrides are cleared at handoff.
No console errors were observed. No hydration/layout regression was found.

Desktop: real CCS2 search; controlled-origin Results/Comparison; 1280 Results.
390px: the driving button directly opens Comparison and shows real provider ETA;
CUP Details correctly retains the 4-minute route. 320px: real Type 2 search,
Details/expanded equipment, etiquette, report category/review (explicitly not
submitted), and Grow Points coming-soon dialog. Voice trigger remains present;
no Voice Worker configuration or deployment changed. Spoken-command and physical
mobile browser tests were not run. Missing forecasts remain hidden. Expiry,
cross-station/connector/model rejection and canceled late replies pass automated
tests; live expiry of a published forecast is unrun because none was published.

Post-deployment controlled-origin HTTP 200 at 06:01:17 UTC returned Opera
69 s/213 m, CUP 194 s/979 m and Santuokų rūmai 247 s/1,531 m. The UI showed
2/4/5-minute ceiling estimates. Calculation timestamps respectively:
06:01:17.040, 06:01:17.068 and 06:01:17.049 UTC.
The fresh 390px selected-charger request returned HTTP 200, CUP 217 s/951 m
at 06:02:29.240 UTC and Santuokų rūmai 315 s/1,744 m at 06:02:29.203 UTC;
the UI showed 4/6 minutes. Both batches were genuine traffic-aware TomTom routes.
No provider rate-limit or quota rejection occurred in these acceptance batches.

Local raw JSON/screenshots are evidence only and excluded from commits.
Full dual-feature success is not claimed: genuine AI publication/visibility remains blocked.
