# TASK-009 visual review — 2026-10-10

Uncommitted local implementation; no deployment, collection or TomTom requests.
Coordinates used for location tests are explicitly simulated: 54.7 N, 25.3 E.
No physical-device GPS or current charger availability is claimed.

## Review captures

- android-location-expanded.png: Pixel_8, 1080x2400; simulated blue location dot,
  expanded sheet, explicit user-origin opt-in and stale compatible Type 2 evidence.
- android-location-simulated.png: Pixel_8 simulated location with collapsed sheet.
- android-driver.png / android-network.png: Pixel_8 driver and network views.
- android-network-pair.png: scrolled Pixel_8 historical cross-operator comparison.
- android-location-denied.png / android-location-unavailable.png: actual emulator
  foreground permission denial and disabled-location-services handling.
- web-mobile-details.jpg: production Chrome, 390x844, expanded station details,
  simulated location and user-origin opt-in; fresh availability is unverified.
- web-mobile-location-simulated.jpg: production Chrome, 390x844, simulated dot.
- web-mobile-driver.jpg / web-mobile-network.jpg: production Chrome, 390x844.
- web-desktop-driver.jpg / web-desktop-network.jpg: production Chrome, 1440x1000.
- web-location-unavailable.jpg: browser unavailable-location simulation.
- android-before.png: pre-polish emulator baseline retained for comparison.

## Verification

TypeScript and zero-warning lint passed; node --test scripts/*.test.mjs: 58 passed,
zero failed/skipped. Web production export, Android JS/Hermes export and Android
app:assembleDebug passed. Merged manifest has coarse/fine foreground permissions,
no background location or location foreground-service permission.

Chrome and Pixel_8 interactions verify dot/recentering, explicit route-origin
choice, Driver/Network navigation, connector/power controls, station selection,
collapsed/expanded sheets and conservative stale evidence. Browser unavailable
and timeout messages were observed; browser denial is deterministic test evidence.
Android actual denial and disabled services were observed. Hook regression covers
permission-dialog backgrounding, duplicate presses and rejecting background fixes.

All current DEV observations are stale. Fresh real-data recommendation/provider
comparison from the user position and recommendation selection remain unrun in
this pass to preserve the no-TomTom constraint; existing deterministic regressions
pass. Physical GPS, exhaustive keyboard/screen-reader acceptance and Android
startup reliability remain unverified. Earlier intermittent Fabric SIGSEGV is not
claimed fixed. User visual acceptance is pending.

Review preview: web http://localhost:8082; Android debug Metro localhost:8084,
with adb reverse and the emulator debug-server preference set for this preview.
Location clears on backgrounding or after two minutes; press Locate me again to
view a fresh simulator fix. Existing unrelated preview processes are preserved.
