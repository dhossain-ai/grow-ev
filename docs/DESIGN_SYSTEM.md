# Grow EV — Design System

Version: 0.1
Status: Proposed design direction

## 1. Design vision

Grow EV should feel like a premium, modern EV product.

Design inspiration:
- Tesla: simplicity and map-first experience.
- Modern navigation apps: clear location and routing.
- Professional geospatial software: useful operational data.

Do not copy another company's exact interface.

Grow EV must develop its own recognizable design identity.

## 2. Design principles

1. Map first, but never sacrifice clarity.
2. One clear primary action per screen.
3. Show important information before secondary details.
4. Prefer meaningful information over decoration.
5. Explain recommendations clearly.
6. Keep animations smooth and purposeful.
7. Design for real users, not only screenshots.
8. Always communicate data freshness and uncertainty.

## 3. Visual identity

Initial direction: premium dark automotive interface.

### Proposed color tokens

Background:
- Main: #101315
- Surface: #1B2023
- Elevated surface: #252C30

Text:
- Primary: #F6F8F8
- Secondary: #A6B0B4
- Muted: #738087

Brand:
- Primary accent: #C7F36B
- Accent foreground: #101315

Status:
- Available: #39C891
- Warning: #F3B34C
- Unavailable: #EF6C73
- Informational: #68B8EF

These are starting tokens, not final approved colors.

Do not use colors directly throughout components.
Use shared semantic design tokens.

Check WCAG contrast before release.

Do not communicate charger status using color alone.

## 4. Typography

Use a clean modern sans-serif font.

Prefer a locally bundled, properly licensed font or a native system font.

Hierarchy:
- Large display: major decisions and numbers.
- Title: screen or station name.
- Body: instructions and descriptions.
- Caption: timestamps and secondary metadata.

Avoid:
- Excessive font weights.
- Tiny unreadable numbers.
- Long text inside map markers.
- Multiple competing headlines.

Important information must remain readable outdoors.

## 5. Spacing and layout

Use a consistent spacing system:

4, 8, 12, 16, 24, 32, 48.

Minimum comfortable mobile touch target:
Approximately 44–48 logical pixels.

Respect native safe areas.

Support different screen sizes.

Avoid absolute positioning unless needed for map overlays.

## 6. Driver app

The driver app is mobile-first.

### Main screen

Full-screen map.

Overlay:
- Grow EV identity.
- User location.
- Search or destination entry.
- Charging filters.
- Recommended charging option.
- Bottom sheet with important details.

Map should remain visible during normal interaction.

### Main user flow

Open app
  -> View network
  -> Choose charging goal
  -> Receive recommendation
  -> Inspect alternatives
  -> Open route/navigation

Avoid mandatory signup during the demo.

### Recommendation card

Show:
- Station name.
- Current availability.
- Connector and charging power.
- Actual estimated driving time.
- Price when verified.
- Recommendation reason.
- Source freshness.

Optional when supported:
- Expected waiting time.
- Charging duration.
- Arrival availability estimate.
- Reliability indicators.

Never display unsupported precise numbers.

### Charger details

Progressive disclosure:

First:
- Is it suitable?
- Is it available?
- How long does driving take?
- How much will it cost?

Then:
- Connector details.
- Historical patterns.
- Additional evidence.
- Alternatives.

## 7. Map design

Renderer:
- MapLibre Native on Android/iOS.
- MapLibre GL JS in browsers.

Basemap candidate:
OpenFreeMap.

Visual rules:
- Roads should be visible but not dominate.
- Charger markers should be recognizable.
- Selected marker must clearly stand out.
- Dense areas should use native map layers or clustering.
- Avoid rendering thousands of arbitrary React markers.
- Provide meaningful zoom-dependent information.

Marker states:
- Available.
- Occupied.
- Unavailable.
- Unknown or stale.
- Selected.

Unknown is not the same as unavailable.

Always provide a legend or understandable status explanation.

## 8. Operator dashboard

The operator dashboard is desktop-first.

Design direction:
Professional geospatial intelligence console.

Primary layout:
- Large city map.
- Network summary.
- Problem list.
- Station detail panel.
- Time filters.
- Evidence and suggested actions.

Avoid building a dashboard with dozens of unrelated charts.

Every chart must answer a specific operational question.

Examples:
- Where is congestion?
- Is suitable spare capacity nearby?
- Is the pattern recurring?
- Is reliability reducing usable capacity?
- What action could help?

## 9. Motion and animation

Use animation to explain state changes and guide attention.

Examples:
- Bottom-sheet expansion.
- Selecting a station.
- Opening recommendations.
- Updating a route.
- Switching between alternative stations.
- Revealing network imbalance.

Suggested motion durations:
- Small interactions: 120–180 ms.
- Panels/transitions: 180–280 ms.
- Larger map transitions: appropriate to distance.

These are initial guidelines, not strict constants.

Avoid:
- Unnecessary glowing effects.
- Continuous animations that distract.
- Layout shifts.
- Heavy effects on every map marker.

Respect reduced-motion preferences.

## 10. Platform consistency

Web and native must share:
- Design tokens.
- Product terminology.
- Domain logic.
- Recommendation content.
- Main user flow.

Platform-specific differences are allowed:
- Map renderer.
- Navigation controls.
- Gestures.
- Permissions.
- Native device integrations.

Aim for the same quality and behavior,
not necessarily pixel-identical rendering.

## 11. Responsive behavior

Mobile:
- Full-screen map.
- Bottom sheet.
- Thumb-friendly controls.
- Minimal text.

Tablet:
- Map with expanded information panel.

Desktop web:
- Map plus persistent detail panel.
- Suitable keyboard and pointer interactions.

Operator view:
- Prioritize desktop.
- Mobile access is optional.

## 12. Accessibility

Required:
- Readable contrast.
- Meaningful button labels.
- Screen-reader support where practical.
- Keyboard navigation for web.
- Visible focus indicators.
- Text scaling.
- Reduced-motion support.
- Status icons plus text.

Do not rely solely on red/green to communicate availability.

## 13. States every screen must handle

- Loading.
- Success.
- Empty result.
- No compatible chargers.
- No location permission.
- Offline.
- Stale data.
- External API failure.
- Unknown price.
- Insufficient history.
- Simulated demo scenario.

Do not show fabricated information to fill empty states.

## 14. Localization

English is the initial development language.

Prepare strings for localization.

Lithuanian is a priority for public use in Vilnius.

Avoid hardcoded user-visible text inside domain logic.

Use appropriate local formats for:
- Time.
- Distance.
- Currency.
- Dates.

## 15. Performance principles

- Keep map interactions smooth.
- Cluster markers where appropriate.
- Use map-native symbol and circle layers.
- Avoid unnecessary rerenders.
- Cache suitable static information.
- Lazy-load expensive screens.
- Limit simultaneous route calculations.
- Test on a real midrange Android phone.

## 16. Design review checklist

Before accepting a UI task:

- Is the primary action obvious?
- Can a new user understand the screen?
- Are numbers backed by data?
- Is source freshness visible?
- Does the browser version work?
- Does the Android version work?
- Are loading and error states handled?
- Is the map smooth?
- Is the UI readable outdoors?
- Does the design look consistent with Grow EV?

## 17. Golden rule

Grow EV should make a complicated charging decision
feel simple without hiding important uncertainty.