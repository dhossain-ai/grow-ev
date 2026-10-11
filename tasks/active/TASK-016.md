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
Supabase or Worker changes. Forecast hooks/proposal from concurrent work excluded
and preserved separately; no TASK-015 edits.

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
