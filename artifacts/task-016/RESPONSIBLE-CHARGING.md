# TASK-016 responsible-charging handoff

## Implementation and scope

Preserves `ec21628f13ca080fad36da634ca3bb302ee69bb9` and
`2e6f6d29580af40666100c4a9424ea40095028b9`. Expanded station details add:

- Report an issue: five requested categories; real selected station name, address
  and canonical ID; optional description bounded to 240 characters. Review is
  local component state. PREVIEW ONLY and Report not submitted remain explicit.
  Closing clears the draft; a station-key change unmounts old state.
- Responsible charging: move after charging, accessible spaces, equipment reports
  and compatible alternatives under congestion.
- Grow Points: Rewards program · Coming soon; future verified contributions;
  no balances, accounts or actual incentives.

Repository endpoint inspection covered `apps`, `services`, `supabase/functions`
and relevant product/intelligence docs. No configured reporting endpoint was
found. No backend, schema, persistence, network submission or dependencies added.
Remote reporting services outside this repository were not enumerated. Existing
voice, routing, maps, forecasts and ranking modules were not changed.

## Files committed

- `apps/driver/src/features/experience/ResponsibleCharging.tsx`: shared sheets and etiquette.
- `apps/driver/src/features/experience/PremiumStationDetails.tsx`: expanded-only mount.
- `apps/driver/scripts/premium-experience.test.mjs`: controlled UI transitions and submission guards.
- `docs/STATUS.md`, `tasks/active/TASK-016.md`: actual state and boundaries.
- `artifacts/task-016/RESPONSIBLE-CHARGING-AUDIT.md`: all 76 original untracked files, classification and hashes.
- This report: checks, exclusions, limitations and future procedure.

## Audit and exclusions

Original count: 76 files: 24 PNG, 31 XML, 20 log, 1 JSON. Each read and hashed;
24 screenshots visually reviewed. Credential-pattern scans found no matches;
runtime logs/device hierarchies remain potentially sensitive and excluded anyway.
All original evidence remains local and untracked. No cleanup or deletion.
No original legitimate source/tests/docs required staging. Generated exports,
Android outputs, dependencies and environment configuration remain ignored.
New local audit JSON/contact sheet, temporary preview server and screenshots/UI
dumps are also excluded. Only named source/tests/docs are staged.

## Executed validation

From `apps/driver`:

- `npm run typecheck`: passed.
- `npm run lint`: passed; additionally `npm run lint -- --max-warnings 0`: passed.
- `npm test`: 92 passed, zero failed/skipped/canceled.
- `npm run build:web -- --output-dir dist-task016-responsible`: passed.
- `npx expo export --platform android --output-dir dist-task016-responsible-android`: passed.

From `apps/driver/android`:

- `gradlew.bat assembleDebug --offline -PreactNativeArchitectures=x86_64`:
  BUILD SUCCESSFUL in 23s; 455 tasks, 19 executed. Existing Gradle deprecation,
  cross-drive hard-link fallback and NO_COLOR warnings remain.

Chrome: real CCS2 station search, expanded details, five-category form, description,
local review, explicit non-submission, close/reset and upcoming rewards. Desktop,
320x568 and 390x844 checked. Long station ID wraps; sheet scrolls vertically.
Pixel_8 emulator-5568: real Opera station details/etiquette; report category,
optional description through native keyboard, local review, Android Back close,
Grow Points open and close. Existing dev host 8084 was mapped to Metro 8081;
old Google Maps picture-in-picture was dismissed to expose controls. Touch actions
were verified through resulting UI state rather than assuming a tap succeeded.
This is a debug app using Metro, not release-installation or physical-phone proof.

Local screenshots (deliberately outside git):

- `responsible-web-report.png`: desktop local review.
- `responsible-web-form-390.png`: mobile form and preview label.
- `responsible-web-report-320.png`: narrow local review, vertically scrolled.
- `responsible-web-points-320.png`: narrow coming-soon information.
- `responsible-android-etiquette.png`: native expanded information.
- `responsible-android-report.png`: native unsent local review.
- `responsible-android-points.png`: native coming-soon sheet.

No new routing/voice requests were necessary for this UI addition. Prior verified
TomTom and human web voice evidence is preserved, not relabeled as newly tested.
Current stale observations stay unverified; missing forecasts remain hidden.

## Limitations and blockers

No real issue submission or rewards exists by design. Reporting/rewards need a
separately reviewed backend and verification policy. Live forecast publication,
fresh-congestion acceptance, physical GPS/phone browsers, Android human speech,
release installation and intermittent native startup/Fabric reliability remain
the previously recorded limitations. None was changed or claimed resolved here.

## Safe future merge and deployment procedure — not executed

1. Fetch `origin`; create an isolated review worktree from current `origin/main`:
   `git worktree add -b review/task-016-merge "E:\Grow EV-task016-merge-review" origin/main`.
   In that worktree run `git merge --no-commit --no-ff origin/task-016-driver-experience`.
   Inspect the complete diff/conflicts, preserve independently changed TASK-015
   files, and rerun typecheck/lint/tests/exports/native build on the combined tree.
   Leave the merge for review; do not push main or force-update the feature branch.
2. Open/review a PR with base main and head task-016-driver-experience. Obtain
   explicit merge approval. `.github/workflows/deploy-web.yml` runs on main pushes.
   If deployment is not also approved, an authorized maintainer must first disable
   that workflow: `gh workflow disable deploy-web.yml --repo dhossain-ai/grow-ev`.
   Confirm it is disabled before merging the reviewed PR. Do not change backend
   migrations, publish predictions or invoke the Voice Worker.
3. After separate deployment approval, verify the merged SHA, Cloudflare target
   and production public environment/project configuration; do not reuse DEV
   credentials/configuration blindly. Re-enable the workflow and explicitly run
   it on main with `gh workflow enable deploy-web.yml --repo dhossain-ai/grow-ev`
   then `gh workflow run deploy-web.yml --ref main --repo dhossain-ai/grow-ev`.
   Confirm the workflow run's head SHA matches the approved merge before rollout.
4. Verify the approved deployed site on desktop/mobile, routes, voice, truthful
   missing/stale forecasts and preview-only reporting. Retain previous deployment
   for rollback. Production rollout is separate from this branch push.
