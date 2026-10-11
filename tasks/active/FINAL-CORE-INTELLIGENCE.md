# Final core intelligence completion

Status: IN PROGRESS — web routing release preparation; publication approval pending.

Scope: ordinary driver journey, genuine TomTom ETA visibility, and genuine
CatBoost publication through an explicitly approved replacement control if needed.
Preserve ranking, filters, native search behavior, collector and Voice infrastructure.

## Findings and implementation

Ordinary Search and Compare alternatives did not initiate routes. Results only
showed the origin charger, while destination estimates required a separate action.
Web searches now opt into a single bounded routing batch. Results expose the
same destination cards and show actual minutes prominently near the top. Origin
is named and identified as a charger rather than inferred driver position.
Existing routing cache, cooldown, cancellation and validation remain in use.

Account settings verify GitHub Pro and a private AI repository; required
environment reviewers are unsupported on that combination. Only dry-run
environment exists; both database secret names exist; no approval variables exist.
The proposed owner-only one-publication replacement is documented in
`artifacts/core-intelligence-completion/PUBLICATION-APPROVAL.md` and awaits
explicit owner approval. No enabling settings, AI workflow or prediction writes
have been changed. Recurring publication remains disabled.

## Current evidence

Read-only DEV audit at 2026-10-11T08:39:13.935028Z: source poll
`c97d35c5-9922-4ce7-ae5a-bb968f2ff6b0`, SUCCESS/COMPLETE, verified, duplicates 0,
1984 locations, 5824 EVSEs, 5826 connectors. 2445 eligible groups, stale/future 0,
prediction rows 0. Source observation range 08:14:28.185–08:14:32.830Z;
expiry would be 09:14:28.185–09:14:32.830Z. Eligibility must be rechecked before
any publication. Cloud dry-run 38124172790 inferred 2445 genuine CatBoost records
using availability_v1; database_writes=false. Model SHA256
`c14082644ae49b617501dd052bdf36ad35092506f21bb13bbaac7a4d430e7e42`.

## Acceptance still required

Final clean checks, controlled deployment and public 1440/1280/390/320 acceptance.
After owner approval: fresh identity/membership validation, one publication,
actual written count, public RPC, genuine visible Outlook and expiry acceptance.
Do not claim dual-feature completion before these pass.
