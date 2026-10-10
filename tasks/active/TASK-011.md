# TASK-011 — Public Deployment and Automation

Status: Release engineering validation passed locally; awaiting the new main CI deployment and public URL verification.
Date: 2026-10-10
Prerequisite: TASK-010 checkpoint.

## Objective

Publish Grow EV on Cloudflare Workers and establish reliable GitHub Actions CI/CD and charging-data ingestion.

## Implementation Details

### Phase 1 - Release Checkpoint
- Verified no sensitive leaked information in TASK-010.
- Committed TASK-010 UI redesign as `8a45860`.

### Phase 2 - Cloudflare Static Hosting
- Configured Cloudflare Workers Static Assets via `wrangler.toml`.
- Configured directory `dist`.
- Maintained static routing compatibility.

### Phase 3 - Production Configuration
- Verified `dist/` contains only public keys (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).
- No leaks of PostgreSQL credentials, Supabase service_role keys, TomTom API keys, or Cloudflare API tokens found in the build output.

### Phase 4 - Public Routing Safety
- The modified routing Edge Function is still un-deployed.
- The app handles routing absence gracefully with a fallback UI.
- An older routing implementation was already deployed to DEV. The undeployed patch does not disable that endpoint; public clients can reach it. No routing calls or redeployment are authorized in this task.

### Phase 5 - GitHub Actions Web CI/CD
- Created `.github/workflows/deploy-web.yml`.
- Automates Expo web export and Wrangler deployment to Cloudflare on `main` push.
- Requires secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### Phase 6 - Automated OCPI Collection
- Created `.github/workflows/collect-chargers.yml`.
- Configured a 30-minute off-the-hour cadence (cron: `14,44 * * * *`) that respects the 60-minute freshness threshold without abusing API rate limits.
- Currently commented out to wait for user approval.
- Requires secrets: `GROW_EV_DATABASE_URL`, `GROW_EV_DATABASE_CA`.

### Phase 7 & 8 - Public Deployment & Demo Readiness
- Ready for manual deployment using Wrangler or GitHub Actions CI/CD after setting up Cloudflare authentication.
- See Demo runbook below for deployment instructions and limitations.

## Demo Runbook

### Deployment Procedure
1. Create a Cloudflare API Token (Edit Workers).
2. Set GitHub Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Set GitHub Variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Trigger the "Deploy Web" GitHub Action manually.

### Collector Automation
1. Set GitHub Secrets `GROW_EV_DATABASE_URL` and `GROW_EV_DATABASE_CA`.
2. To test manually, trigger the "Collect Chargers" GitHub Action.
3. Once verified, uncomment the `schedule` block in `collect-chargers.yml` and merge.

### Known Limitations
- Existing DEV routing remains deployed and is NOT globally rate-limited. The local patch is undeployed; routing was not exercised during release validation.
- Collector scheduling remains commented out. Existing observations may be stale; no refresh was run during release validation.

## Next Steps
- User needs to authenticate Cloudflare or run CI/CD to obtain the final public URL.
- Verify the public HTTPS URL in browser.


## Independent release engineering verification — 2026-10-10

- Baseline local/remote main: `bbf4c8787d4ff82bc364b897ee6f945fa2b874cb`. Matching Deploy Web run `38048704760` failed at dependency installation: missing root `@emnapi/core@1.11.3` and `@emnapi/runtime@1.11.3`. Older runs were not used to diagnose this commit.
- Real isolated WSL Ubuntu / Linux Node 22.22.0, npm 10.9.4 reproduced the error. Added only those two lock entries; existing dependency versions unchanged. Clean npm ci then passed.
- Fresh-checkout TypeScript exposed missing CSS declarations supplied by ignored Expo-generated types. Added a tracked Expo type reference; driver typecheck passed.
- Driver zero-warning lint and all 61 tests passed. Ingestion clean install/typecheck and 13 tests passed; PostgreSQL suite skipped without a disposable database. No collector poll executed.
- actionlint 1.7.7 passed both workflow files (shellcheck/pyflakes unavailable and disabled). Fixed prohibited secrets context in collector step condition using job env; schedule remains disabled.
- GitHub configuration has Cloudflare and public Supabase secret names, but no repository variables. Web build now accepts existing public secrets as fallback. Values withheld.
- Wrangler 4.149.0 rejects original html_handling and accepts auto-trailing-slash with SPA not_found_handling. Production web export and corrected deploy dry-run passed.
- Workflow directories, lockfile paths and package scripts checked. No application rewrite, dependency upgrade, migration, routing deployment or TomTom request.
