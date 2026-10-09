# TASK-002 — Cross-Platform Map Foundation

Status: Implemented, awaiting review
Priority: P0
Owner: Unassigned

## Goal

Render one interactive Vilnius map in Android and web using platform-native
MapLibre implementations and the OpenFreeMap Liberty style.

## Scope

Implemented:
- MapLibre React Native with its Expo config plugin.
- MapLibre GL JS with CSS and an explicit same-origin worker.
- `GrowMap.native.tsx` and `GrowMap.web.tsx` outside Expo Router.
- Shared Vilnius center, zoom and style constants.
- Full-screen pan/zoom map, provider attribution and loading failure messages.

Not implemented:
- Charger data, markers, routing, location, backend or recommendation logic.

## Verification

2026-10-09, from `apps/driver`:
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build:web` — passed.
- `npx expo-doctor` — 21/21 checks passed.
- `npm run android` — debug build passed, installed and launched on `Pixel_8`.
- Android visual check — Vilnius rendered; drag and double-tap zoom worked;
  attribution dialog listed OpenFreeMap, OpenMapTiles and OpenStreetMap.
- Browser visual check — Vilnius rendered; pointer drag and zoom control worked;
  attribution links were present; a fresh post-fix session had no console errors.

## Implementation notes

MapLibre GL JS 6 requires a separately served module worker with Expo Metro.
The npm pre-scripts copy the matching worker files from the installed package
into ignored `public/maplibre/` output before web development or export.

The Android build emits upstream MapLibre/RN deprecation warnings and the
OpenFreeMap style emitted one non-fatal invalid line-geometry warning.

## Completion summary

Acceptance criteria are met. No commit was created. TASK-003 was not started.
