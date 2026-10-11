# First-publication replacement control — awaiting owner approval

Verified 2026-10-11 through authenticated GitHub settings: the personal account
`dhossain-ai` uses GitHub Pro; `grow-ev-ai` is private. Only
`prediction-dry-run` exists. Its settings offer deployment branch restrictions,
secrets and variables, but no required-reviewer control. Repository secrets
`GROW_EV_DATABASE_URL` and `GROW_EV_DATABASE_CA` exist (names inspected only).
README.md requires reviewers before enabling `GROW_EV_ALLOW_PUBLISH`.
GitHub Pro supports environments in private repositories but required deployment
reviewers only in public repositories:
https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments

## Concrete proposed replacement, ONE publication only

After explicit owner approval of this replacement:

1. Keep the existing `predict.yml` publisher and its data, TLS, model, expiry,
   collector-lock and idempotency checks. Add an owner-only manual publication
   preflight: event `workflow_dispatch`, actor `dhossain-ai`, branch `main`,
   first run attempt, exact nonempty source poll UUID and recorded approval
   reference. Reject publication before loading database credentials otherwise.
2. Create `prediction-publication` with selected deployment branch `main` only.
   Add variables `GROW_EV_ALLOW_PUBLISH=approved`, `GROW_EV_APPROVED_POLL`
   (one freshly verified UUID) and `GROW_EV_APPROVAL_REFERENCE` (this approval's
   recorded reference). Require dispatch input poll/reference to match these.
   Do not grant GitHub token write permissions or expose database credentials.
   Check the existing database role's grants; any required credential or role
   change must be presented separately, rather than assuming least privilege.
   Code inspection shows `src/config.py` currently accepts only the DEV
   `postgres` database user. This is a privileged administrative credential,
   so its existence is not proof of a least-privilege publication credential.
   A scoped publisher login/secret and narrowly reviewed validator/grant change
   must be prepared and approved separately if strict credential-level least
   privilege is required. Do not create a role or change secrets implicitly.
3. Record approval, code SHA, model checksum, membership audit, freshness,
   generated/expiry window and actual inserted count. Dispatch once. Failed
   guards stop the operation; no automatic retry and no stale batch substitution.
4. Remove all three enabling variables after the run. Record the run URL and
   public read/visible UI acceptance. Keep the environment and audit history.

This is owner authorization with recorded controls, not an independent reviewer
approval. It changes the README requirement explicitly only after owner approval.
Existing source timestamps and expiry are immutable. No MLP writes, training,
collector changes, schema changes or public write permissions are included.

## Recurrence

NOT authorized by this proposal. Hourly collection/archive/inference remain
unchanged and dry-run only. Recurring writes require a separately approved
owner policy, model/poll validation, locks/idempotency and aggregate audit per
cycle; one subsequent scheduled cycle must be verified before claiming it works.

## Owner UI if an owner must configure the environment

Repository Settings → Environments → New environment →
`prediction-publication` → Deployment branches and tags → Selected branches
and tags → add branch `main`. Add the three variables above only after approval
and fresh poll validation. Actions → Predict Charging Availability → Run workflow
on `main`, mode `publish`, exact approved poll/reference. Remove the variables
after the single run. Never paste database credentials into dispatch inputs.

No publication settings or mandatory reviewer requirement have been changed.
