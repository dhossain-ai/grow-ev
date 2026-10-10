# TASK-011 — Public Deployment and Automation

Status: Implemented locally. Awaiting manual Cloudflare configuration and public URL verification.
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
- Not deploying the Edge Function ensures no unexpected paid routing exposure.

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
- The TomTom Routing Edge function is NOT globally rate-limited. It is still disabled in production to protect quotas.
- Data ingestion is currently triggered manually or on a 30-minute schedule (pending approval), so real-time status in the UI might be up to 30 minutes old. Stale readings are labelled as such.

## Next Steps
- User needs to authenticate Cloudflare or run CI/CD to obtain the final public URL.
- Verify the public HTTPS URL in browser.

