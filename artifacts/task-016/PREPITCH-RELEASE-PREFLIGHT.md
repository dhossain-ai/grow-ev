# Controlled TASK-016 pre-pitch release

Approved feature: `20d06278e423aecec92826ed96fa253150a45948`.
Reviewed main: `8f995615d548807c6ae95779beb90a9c255a31fa`.
Release preparation: `release/task016-prepitch` in `E:\Grow EV-release-task016`.

## Conflict and infrastructure preservation

The sole conflict was competing insertions at the start of `docs/STATUS.md`.
Both complete sections were retained: TASK-015 infrastructure history and its
outstanding limitations, followed by all three TASK-016 implementation sections.
No ours/theirs replacement was used. TASK-015 status is retained as historical
documentation; this release does not claim new pipeline verification.

Driver/task evidence matches the approved feature tree exactly. All incoming
main commits since fork `226c7a007a3f8891b531d2999d0e6af4b66f0dc7` were reviewed:
`d913253`, `067a243`, `94e7447`, `301c98f`, `b9b880b`, `8f99561`.
No UI integration diff under `.github`, `services`, or `supabase`; collector
workflow/configuration, Voice Worker and migrations remain latest-main versions.
Main and TASK-015 have no pending tracked edits. Inference workspace
`E:\grow-ev-ai-task015`, branch `task-015-history-inference`, is clean at
`36274546c330cc36c2391eb1fb076cbed92ebf1b`. These observations are point-in-time;
main is fetched again before pushing the release.

## Deployment gates

`.github/workflows/deploy-web.yml` (GitHub workflow ID `380411627`, active)
automatically runs on main pushes and executes Wrangler deploy from `apps/driver`.
Its unchanged `wrangler.toml` names `grow-ev-demo`, serving `dist` static assets.
GitHub metadata confirms CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID,
EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are configured.
Secret values were not printed or committed. Previous web run `38065979368`
succeeded; zero queued/in-progress web runs existed at preflight.
Only one normal main push will trigger release; no workflow dispatch/manual deploy.
Collector workflow is unchanged and is not triggered by a main push.

Original untracked UI evidence remains in the feature workspace. Temporary env,
dependencies, Expo assets and exports in the release worktree are ignored. The
76 approved feature files include selected verification evidence, not packaged
web/Android exports or dependencies. Staged text credential-pattern scan had
zero flags. No new code/dependencies/features are added by this release.

## Immutable rollback baseline

Worker: `grow-ev-demo`; URL: https://grow-ev-demo.dhossain.workers.dev.
Current pre-release deployment ID: `5e90e147-9049-43bb-b33d-8f3e795dbf5b`.
100% version: `40f44261-6217-459b-811c-0120353e7f4b`.
Created: `2026-10-10T16:04:09.27703Z`. Confirmed with read-only Wrangler deployment
history before release; old version/assets are retained, not deleted.

Voice baseline: 100% `1944c700-ec6f-43b6-9846-a8abbb2b5a5d`, deployment at
`2026-10-10T15:42:52.570Z`. Public-origin OPTIONS /transcribe returns HTTP 204
and matching CORS. Recheck version and voice after web rollout; do not deploy voice.

If production acceptance fails, from `apps/driver` using the authenticated
Wrangler/account for this site:

```powershell
npx wrangler rollback 40f44261-6217-459b-811c-0120353e7f4b --name grow-ev-demo --message "TASK-016 acceptance rollback" --yes
npx wrangler deployments list --name grow-ev-demo --json
```

Confirm latest deployment serves the rollback version at 100%, then reload the
public website and verify restored behavior. This redeploys an existing version
of the same Worker; it does not touch collector/voice or schemas. Preserve failed
run/log evidence. Do not revert/push main automatically (that would trigger another
web deployment); review the failed release separately.

## Validation record

Combined-tree checks executed from `apps/driver`: `npm run typecheck` passed;
`npm run lint -- --max-warnings 0` passed; `npm test` passed all 92 tests with
zero failures/skips/cancellations; `npm run build:web` exported all four routes
successfully. `git diff --cached --check` passed. No unmerged index entries remain.
Production run URL/version and actual public acceptance will be
reported after the one approved push; no second evidence-only main push is needed.
Clean lockfile installation completed; npm reports 29 dependency audit findings
(10 moderate, 19 high). No dependency remediation is performed during this
feature-preserving release. This is a remaining dependency-maintenance limitation.
