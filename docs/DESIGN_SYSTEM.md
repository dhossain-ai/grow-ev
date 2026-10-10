# Grow EV — Calm Electric

Version: 0.2 · Approved light direction · TASK-010 local implementation, review pending

The charging decision is the primary content. The interactive map provides geographic
context. One useful action, short explanations and honest evidence take priority over decoration.
There is no dark mode or claim of native Apple Liquid Glass rendering.

## Tokens

Shared source: `apps/driver/src/features/map/tokens.ts`.

| Role | Value |
|---|---|
| Canvas / surface / secondary surface | #F8FAF7 / #FFFFFF / #F0F4EF |
| Primary / secondary / muted text | #17211E / #52615A / #607068 |
| Border | #E5EAE6 |
| Primary action / foreground | #C7F36B / #17211E |
| Accent supporting surface / ink | #F0F9E4 / #39551C |
| Available / occupied / unavailable markers | #20B887 / #E8A23E / #E76E70 |
| Available / warning / unavailable text | #13795B / #8B590D / #B23D47 |
| Foreground location / focus | #328DFF / #246CC0 |

Secondary text and semantic text use darker variants for legibility on white.
Status is also expressed in words; stale map markers use the neutral unverified color.
System fonts only. Display 30, section 22, card 20, body 15, caption 12; values and
network headings may use 26–34 where appropriate. Spacing follows 4/8-point increments.
Primary cards use 24px radii, secondary cards 18px, actions 12px, compact map controls
14–16px. White content surfaces, fine borders and a restrained single panel shadow.
Only map controls/legend use a nearly opaque translucent surface; no nested glass,
gradient, decorative glow, saturated panel or emoji icon.

## Driver hierarchy and interaction

1. Compact brand header; Network Intelligence is secondary navigation.
2. `DriverAssistant`: choose CCS2, Type 2 or CHAdeMO, then Find charging options.
3. Choose a station from the fetched map area or tap a map marker. These are discovery
   results, not a global ranking or personalized vehicle match.
4. `ExperiencePanel` / `StationDetail`: selected station, shared connector requirement,
   current compatibility evidence and eligible alternatives. Aggregate site power/status
   remains explicitly separate from connector-level capacity. Additional site statistics
   are behind Station information; collapse retains a concise station summary.
5. `ChargingRecommendationCard`: one primary eligible option, compatible observed EVSE
   count, true route origin, legitimate drive estimate or Driving time unavailable,
   explanation and original observation timestamp. Compare alternatives discloses the rest.
6. Compare driving times invokes the existing explicit routing comparison. Select this
   charger performs station selection/recentering. No View route/navigation action is
   advertised because this implementation has no route geometry or navigation launch.

The selected connector stays consistent between the assistant and live station details.
Map discovery filters remain separate from recommendation eligibility, including power.
Location stays explicit, foreground-only and optional, using TASK-009 safeguards.
The locate control and attribution stay outside the content panel.

## Stale and missing evidence

Current availability is unverified when observations are stale. No automatic startup
recommendation, renewed timestamps, invented ETA, price, waiting time or probability.
Missing-compatible, unknown, unavailable, loading, empty and API-error states retain
human-readable explanations and real actions such as connector choice or retry.

`HistoricalCase` is a separate recorded CCS2 case, independently labeled on both the
screen and each card. `recordedCase.json` contains four sanitized captured station/EVSE
records and original TASK-008 TomTom summaries. It does not feed live recommendation
state or call routing. The case uses 10 October 2026 observations at 03:46 and estimates
at 04:14 Europe/Vilnius. Explore this station exits the historical view and checks current
persisted evidence; it never treats the recorded capacity as current.

## Map and responsive layouts

MapLibre Native and GL JS remain interactive. OpenFreeMap Positron reduces visual
competition with the decision cards. Existing batched GeoJSON/clustering remains;
charging glyphs, small white clusters, a selected ring and neutral stale markers use
map layers. A blue location dot has a white outline; its halo is decorative, not accuracy.

Below 900px: floating bottom panel with bounded height, internal scrolling, safe-area
shell and nearby locate control. The initial panel is capped at 440px; expanded station
or case content uses 72% of map height. At 768px the panel stays constrained to 420px.
At 900px and above: 400px side panel; map controls occupy the remaining space. The home
panel is capped at 500px, while station/case views can use the taller side panel.
Power-filter rows scroll horizontally instead of overflowing. Network panels switch
from stacked content to desktop columns at 900px; statistics remain subordinate.

Chrome captures at 360, 390, 768, 1280 and 1440px and Pixel_8 native captures are in
`artifacts/task-010/`. These are implementation evidence, not user visual acceptance.

## Motion and accessibility

Tokens: press 120ms, selection 160ms, card 220ms, panel 280ms. Implemented card reveals
use restrained eased opacity; presses give immediate opacity feedback. Map selection
and recentering use 280ms where supported, or zero with reduced motion. Sheet expansion
and connector selection update immediately; no spring dependency or continuous motion.
Reduced-motion preference defaults conservatively to enabled until resolved and is
observed through React Native AccessibilityInfo; browser CSS also suppresses motion.

Actions use 44–48px practical targets, accessible labels, connector pressed/selected
state, disabled states and web focus outlines. Cards/filters scroll, and Expo safe areas
remain authoritative. Chrome keyboard/focus and reduced-motion checks are recorded in
the evidence README. Exhaustive assistive-technology and physical outdoor checks remain
unverified; Android Fabric startup intermittency is not claimed fixed.

## Network Intelligence

A light desktop-oriented study view leads with the opportunity to use existing Vilnius
charging capacity better. Two operator/location endpoints, compatible capacity,
straight-line distance, observation date and historical/current labels form the main
panel. Fresh pair counts and dated network status totals are secondary. Coverage remains
the existing fetched study-window/radius intersection, never a complete Vilnius census.
No calculation, database, collector or routing-service change accompanies this redesign.

## References reviewed

- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/): clear hierarchy and progressive disclosure.
- [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials): functional layering and restrained materials; solid information surfaces here.
- [Material 3](https://m3.material.io/): semantic color roles, adaptive hierarchy, purposeful motion and varied shapes.

These inform Grow EV's own visual language; no brand interface or component library was copied.
