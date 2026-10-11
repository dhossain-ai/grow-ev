# TASK-016 driver intelligence integration — 2026-10-11

This follow-up preserves premium UI commit `ec21628f13ca080fad36da634ca3bb302ee69bb9`
on `task-016-driver-experience`. No merge, deployment, prediction publication,
model retraining or TASK-015 infrastructure edits were performed.

## Routing and origin evidence

The original premium flow only offered routing when fresh congestion at the
selected charger produced eligible alternatives. Ordinary compatible searches
and stale observations therefore never sent a routing request. The deployed DEV
backend is available to guests; the UI gate was the demonstrated cause of missing
estimates in those searches. It was fixed in the preserved premium commit.

`integration-live.json` records a real Norfa Ateities → Simbiocity Nova route:
HTTP 200, 438 seconds, 4,924 metres, traffic-aware TomTom response, CORS `*`.
The origin and destination are actual station coordinates, not a driver GPS fix.
`integration-web-routed.txt` and `.png` record real 4/5-minute web estimates;
`integration-android-detail.xml` and `integration-android-routed-details.png`
record a real 2-minute native estimate from the selected charger.

Both platforms use the same search hook and routing client. Default routing uses
the selected charger; an explicit foreground location action supplies a separate
user origin. Exact origin/destination matching prevents cross-origin reuse.
User origins expire after two minutes and clear on backgrounding. This follow-up
starts that age at request initiation, so API latency cannot renew a location.
Routing remains explicit, limited to three candidates, cached and rate limited;
failure keeps external navigation available. Physical driver GPS routing is unrun.

## Actual production ranking

The unchanged engine requires compatible fresh congestion at the anchor and fresh
compatible AVAILABLE capacity at alternatives. Canonical EVSE identity prevents
multiple connectors from being counted as separate points. Observations older
than one hour, future/invalid observations and UNKNOWN cannot establish spare
capacity. It selects the nearest three alternatives within 10 km by geographic
distance, available count and stable station ID. Complete fresh routes with the
same origin and traffic-awareness mode enable driving-duration ranking, then
geographic distance, observed spare capacity and stable ID break ties.

Power and CatBoost forecasts do not influence production ranking. Single-standard
site power can establish the compatible advertised maximum; mixed-standard site
maxima cannot. The actual public capacity RPC supplies connector standards but
no connector-specific power. No unsupported power or charging duration is shown.

`powerRankingProposal.ts` is an unused, tested proposal for equal verified drive
times: prioritize higher evidenced compatible power while leaving unknown-power
positions unchanged. It needs policy review before any production caller is added.
No extra-drive/power tradeoff threshold has been invented.

## CatBoost public read integration

Read-only inspection used the TASK-015 prediction migration, integration patch,
actual inference producer and `availability_v1_metadata.json` in the AI repo.
The driver uses only `get_charging_prediction` with the public Supabase key.
No client reads the private table or receives service-role credentials.

The parser retains prediction and source-poll identities and validates exact
station, connector, `availability_v1`, reviewed CatBoost SHA-256, next-observation
horizon, experimental flag, finite output, timestamp chronology and expiration
within one hour of the source observation. The public RPC validates the latest
genuine complete verified poll and excludes replays/newer-poll-invalidated records.
The view additionally matches the oldest compatible observation exactly.

Results, comparison rows, details and expanded information share the Beta outlook.
The existing integration patch's 0.35/0.65 display thresholds are reused; they are
uncalibrated display policy, not validated risk categories or accuracy estimates.
The output concerns the next observation, never the driver's arrival. Missing,
expired, stale, wrong-identity and invalid records are hidden. Request/contract
errors show a neutral unavailable state. Expiry timers remove forecasts at their
deadline; backgrounding clears forecasts and invalidates late responses. Reads
occur on view/evidence changes, with an eight-second timeout and no polling/retry.

`integration-public-read-1791678542516.json`: at 03:29 Europe/Vilnius, public map,
capacity and prediction RPCs returned HTTP 200; the checked station had `[]`
predictions. Direct anonymous prediction-table read returned HTTP 401.
`intelligence-web-responses.json` confirms successful prediction reads through the
actual exported browser app. No currently usable live forecast was observed in
the checked views. Valid forecast rendering is supported by explicitly synthetic
contract fixtures and lifecycle tests; it is not live published-model UI proof.

## Voice preserved

Voice source, parser and backend are unchanged from `ec21628`.
`voice-live-proof.json` retains the separate human web speech → deployed Whisper
HTTP 200 → Type 2 → real charging search evidence, including the narrow
"Type 2 charges" recognition fix. This is not a claim that the exact CCS2 near-me
phrase succeeded on a human Android microphone. That check remains unverified.

## Final validation

- `npm test`: 90 passed; zero failed, skipped or canceled.
- `npm run typecheck`: passed.
- `npm run lint -- --max-warnings 0`: passed.
- `npx expo export --platform web --output-dir dist-task016-intelligence`: passed.
- `npx expo export --platform android --output-dir dist-android-intelligence`: passed.
- `gradlew.bat assembleDebug --offline -PreactNativeArchitectures=x86_64`: passed,
  36 seconds, 455 tasks. This is debug build proof; final JavaScript was exercised
  via Metro, not an installed release APK.
- Final Chrome real CCS2 search/details: passed; stale availability and missing AI
  remain neutral/hidden. Pixel_8 real CCS2 search: passed; mixed-standard power is
  withheld. `intelligence-web-results.png` and `intelligence-android-results.png`
  are real captures. Native HTTP response inspection was not added.
- `git diff --check`: passed. Voice, maps, production recommendations, Supabase,
  services and TASK-015 infrastructure have no changes against the premium commit.

The first final-build logging command targeted a nonexistent parent directory and
did not execute Gradle; the corrected command above passed. An earlier parallel
export encountered a Metro cache deserialization warning and recovered; final
exports were rerun sequentially. Existing Gradle/NO_COLOR warnings remain.

Remaining: genuine live forecast publication/rendering when independently
authorized, fresh-congestion ranking acceptance, physical GPS/phone browsers,
Android human speech, release installation/navigation and native startup reliability.
Older untracked UI evidence was preserved and excluded from this integration commit.
