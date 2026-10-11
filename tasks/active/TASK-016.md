# TASK-016 — Approved premium driver experience

Status: Implemented and locally verified; physical-device/visual limits remain.
Workspace: E:\Grow EV-task016. Branch: task-016-driver-experience.
Baseline:226c7a0. User authorized task-branch commit; no merge/deployment.

Shared premium home/results/comparison/details and expanded information use real
charging APIs. Network header link removed. Compact microphone, connector icons,
visible CTA, collapsible sheets, loading/error/manual recovery and coordinate-based
navigation implemented on web/Android. Clipboard uses Expo Clipboard.

Canonical EVSE identities/statuses, freshness, conservative compatible power and
existing congestion recommendation policy remain. Unranked compatible stations
are distinguished. Explicit routes are bounded, match identity/age and expire;
user origins require foreground action and expire after2min. No new AI/model,
Supabase or Worker changes. The premium commit preserved the forecast work separately;
the driver intelligence follow-up below integrates it without TASK-015 edits.

Both maps use the same restrained Positron paint refinement with existing provider
and geography. Markers remain the existing availability-aware circles/clusters.

Old web was localhost:8082 from main E:\Grow EV. Final task preview is
http://localhost:8167/?build=task016-parity, serving dist-task016-speech no-store.
Human web microphone-to-Worker-to-real-Type2-results succeeded. Denied permission
was user-observed. Narrow parser correction accepts Whisper's Type2 charges
wording without accepting negated/conflicting/ambiguous commands.

84 tests, strict TypeScript and zero-warning lint pass. Separate final web/Android
exports pass; native x86_64 debug build passed. Chrome responsive and Pixel_8
interaction evidence were recorded separately. Native details/copy, microphone
denial/listening/cancellation and Maps launch verified; Android human speech
success remains unverified. Final JS/map were exercised via Metro, not release APK.

Remaining acceptance: physical iPhone Safari/Android Chrome, Android human voice,
repeated native startup reliability, complete reference visual acceptance, physical
navigation and genuine fresh-congestion live ranking/routing.
See artifacts/task-016/README.md for provenance, checks, captures and limitations.

## Driver intelligence follow-up — 2026-10-11

Based on preserved premium commit `ec21628f13ca080fad36da634ca3bb302ee69bb9`.
CatBoost public RPC reads now feed shared results/comparison/details Beta outlooks
only for matching station/connector/model/poll provenance and compatible observation.
Missing, expired, stale or invalid forecasts are hidden; errors are neutral. Exact
expiry and background cancellation are tested. Driver-origin age starts before
I/O. Production ranking and the human web voice success fix remain unchanged;
power ranking is a separate unused tested proposal.

90 tests, TypeScript, zero-warning lint, sequential final web/Android exports and
offline x86_64 debug assembly passed. Final Chrome and Pixel_8 real CCS2 searches
retain truthful stale-data/connector-power behavior. Deployed prediction RPC returned
200 with no record for the checked station; private anonymous table access returned
401. Previously verified web 4/5-minute and native 2-minute TomTom evidence retained.

Integration implemented and locally verified; live published forecast, physical
GPS/devices, Android human voice and fresh-congestion acceptance remain pending.
See `artifacts/task-016/INTELLIGENCE-INTEGRATION.md` for the final evidence report.
Commit only this driver integration and named evidence; stop after commit. No
deployment, merge, publication, model retraining or infrastructure changes.

### Responsible-charging follow-up — 2026-10-11

User-authorized follow-up adds compact etiquette, a real-station report preview
and Grow Points information only inside expanded details. Reporting remains
explicitly unsent; no backend or accounts. Original 76 untracked files audited
and preserved locally. 92 tests, typecheck, zero-warning lint, both exports and
offline x86_64 debug build passed. Chrome desktop/320/390 and Pixel_8 sheet
interactions verified. Preserve both completed commits; one focused additions
commit and normal feature-branch push are authorized. Stop after push and report;
main merge, deployment, TASK-015 and Voice Worker changes remain out of scope.
See `artifacts/task-016/RESPONSIBLE-CHARGING.md` for evidence and safe future gates.

## Responsive release hotfix — 2026-10-11

Premium main merge failed fresh desktop hydration acceptance and was rolled back.
A shared hydration-aware viewport hook preserves server/client initial styles and
applies desktop/narrow/compact layout automatically. Cold and hard production-export
loads pass at 1440/1280/768/390/320px; 95 tests, TypeScript, zero-warning ESLint
and web export pass. 106 local evidence/temp files are archived and individually
excluded locally with no deletion. Existing native and infrastructure behavior is
unchanged. Public deployment/acceptance will be recorded after the approved push.
