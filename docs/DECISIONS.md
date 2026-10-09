# Grow EV — Engineering Decisions

Status: Initial decisions
Version: 0.1

## ADR-001 — Universal application

Decision:
Use Expo + React Native + TypeScript.

Reason:
Share product logic and much of the UI across Android,
iOS and a browser-accessible hackathon demo.

Alternative approaches:
- Flutter
- Separate native Kotlin/Swift apps
- PWA-only development

Revisit if:
Performance, native integrations or browser constraints
make the shared approach unsuitable.

## ADR-002 — Maps

Decision:
Use MapLibre.

Native: MapLibre React Native.
Web: MapLibre GL JS.

Basemap:
Use the public OpenFreeMap Liberty style initially:
`https://tiles.openfreemap.org/styles/liberty`.

Reason:
Open-source renderer, custom styling and control of
map visualization.

Important:
Basemap tiles are a separate service.

Verified:
MapLibre React Native 11.5 works with Expo SDK 57 / React Native 0.86 using
the official Expo config plugin and a development build. MapLibre GL JS 6.13
works with Expo Metro when its ESM worker is served as a same-origin public
asset. OpenFreeMap supplies the required OpenFreeMap, OpenMapTiles and
OpenStreetMap attribution through the style.

## ADR-003 — Routing

Decision:
Use a replaceable routing adapter.

Initial candidate:
TomTom traffic-aware routing.

Fallback candidate:
OpenRouteService.

Reason:
Actual road routing and traffic-aware ETA are important
to charger recommendations.

Verify:
Account quota, terms, rate limits and geographic coverage.

## ADR-004 — Database

Decision:
PostgreSQL + PostGIS, initially hosted on Supabase.

Reason:
Structured entities, historical data and geographic queries.

## ADR-005 — Intelligence

Decision:
Use deterministic calculations and statistical baselines first.

Use Python for experiments and ML when justified.

Reason:
Correctness, interpretability and limited historical data.

## ADR-006 — Large language models

Decision:
No LLM in the critical recommendation path.

Reason:
Routing, compatibility, availability and optimization need
validated data and calculations rather than generated answers.

Revisit:
Conversational assistant or explanation features.

## ADR-007 — Driver application

Decision:
Map-first interface with clear recommendations.

Reason:
Users should see the charging network and quickly understand
what Grow EV recommends.

## ADR-008 — Operator experience

Decision:
Web-first intelligence dashboard.

Reason:
Geospatial analysis, historical patterns and operational
comparison benefit from desktop layouts.

## ADR-009 — Hackathon access

Decision:
Provide public web demo via QR code.

Show native Android application if ready.

Reason:
Judges should not be required to install software.

## ADR-010 — Agent workflow

Decision:
Use one root `AGENTS.md` for shared agent instructions.

Use small tasks and concise status handoffs.

Reason:
Reduce duplicated context and avoid conflicting agent rules.

## Open decisions

- Routing API account and quota validation.
- Polling interval and scheduler.
- Grow Score weights and presentation.
- Exact availability-prediction baseline.
- Production hosting and authentication details.

These are not finalized until verified.
