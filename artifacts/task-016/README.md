# TASK-016 parity evidence

Branch: task-016-driver-experience. Workspace: E:\Grow EV-task016.
No production deployment, main merge, TASK-015, database/model or Worker changes.

## Preview provenance

The old interface was reproduced at http://localhost:8082/. Its Expo process
runs E:\Grow EV\apps\driver on main. It contains Network, a permanent Voice
assistant and the old charging layout. This is an old local-main preview;
no evidence identifies the user's original screenshot as production.

Final preview: http://localhost:8167/?build=task016-parity.
From apps/driver: node scripts/preview-task016.cjs.
It serves dist-task016-speech from this task workspace with Cache-Control:no-store.
Bundle: entry-58b345dd96d63cb3cfa558bb71973113.js.
SHA256: A8D7EA1D52CBDC629E0FDE41E7D030B52717D52F05EBB10BB1A199F9F4E0FE7B.
A fresh origin, explicit bundle and reloaded page exclude old-main/cache confusion.
Earlier port8166 served a premium task export preceding final refinements.

## Web evidence

Desktop Chrome responsive checks at320x568,390x844 and1440x900; these are not
physical iPhone Safari/Android Chrome checks. Premium home has no Network link,
connector controls, microphone action and visible CTA (bottom542 within568;
bottom808 within844). Actual API search, loading, results, comparison and details
ran. Controlled browser offline mode produced Charging data unavailable and
Try again; networking was restored and recovery verified.

Human-assisted voice: user blocked permission and confirmed Microphone access
is off. User then allowed microphone access, spoke and stopped recording.
Observed Listening, processing, Worker HTTP200, transcript Show type 2 chargers.,
get_map_stations/get_station_capacity HTTP200, and Charging options nearby with
Eldrive Lithuania VILNIUS TECH Centriniai Rūmai. Data was labeled stale/unverified.
This proves command-to-action, not merely transcription. Earlier Whisper
Show type 2 charges. was rejected; a narrow Type2 charges grammar now accepts
that clear intent and rejects ambiguity/negation/conflicting connectors.
See voice-live-proof.json. No raw audio saved. Human success preceded final
source isolation/export; the same voice action/search contracts were retained.
Final isolated export was separately reloaded and searched successfully.

## Android evidence

Pixel_8 debug APK installed/built. Earlier system ANRs/black rendering were
resolved by reboot without clearing data. Native real search, comparison,
details/expanded information, historical status breakdown and Copy address ran.
Copy resolved and Android displayed its clipboard preview. Microphone denial,
Listening after ADB permission grant and Android Back cancellation verified.
Google Maps opened through google.navigation after removing canOpenURL gating.
No Maps location permission or actual trip claimed. Final current JS/map/home
and search/detail flows exercised through Metro. Studio/emulator remain open.
Final JS was not packaged into a standalone release APK.

## Map and domain decisions

Shared vendored Positron style changes only paint colors: warm background,
sage parks/woods, blue water, grey buildings and subdued labels. OpenFreeMap
provider, sources, filters, layer/zoom rules and roads retained. Both platforms
render the same palette without extra layers/polling; no performance benchmark.
Existing availability markers/clusters remain; individual circles differ from
reference teardrops. All nine approved images were viewed in this task.
Canonical EVSE status/freshness, conservative mixed-site power and congestion
ranking remain. Compatible rows are distinct from ranked recommendations.
Manual routing is explicit and bounded to3 valid destinations; displayed routes
require matching origin/destination and age. User-origin fixes expire at2min.

Concurrent agent additions were preserved in
E:\Grow EV-task016-preserved-20261011. Prediction UI hooks/tests and speculative
power proposal were excluded. Reviewed bounded routing/expiry fixes retained.
Untracked predictions and task016-live.mjs remain outside this commit.

## Checks and captures

npm run typecheck: passed.
npm run lint -- --max-warnings 0: passed.
npm test:84 passed,0 failed,0 skipped.
Web export dist-task016-speech:passed; Android export dist-android-speech:passed.
Offline x86_64 assembleDebug:passed,455 tasks (native modules unchanged thereafter).
git diff --check:passed.

Final: web-final-home.png, web-final-results.png, web-final-error.png,
android-final-home.png. Additional parity: web-parity-home-320.png,
web-parity-compare.png, web-parity-details.png, android-parity-home.png,
android-parity-details.png. Voice: web-parity-listening.png and
web-parity-voice-results.png. Prior native: android-expanded.png,
android-microphone-denied-ui.xml, android-recording-ui.xml,
android-navigation-fixed-ui.xml. Old-main evidence:web-old-main-8082.png.
Only named review evidence is committed; debug intermediates remain local.

Remaining: real Safari/Android Chrome devices, Android human spoken-command
success, repeated native startup reliability, all-reference visual acceptance,
physical navigation and genuine fresh-congestion ranking/live routing.
