# Grow EV

EV charging intelligence for drivers, operators and cities.

## Project

Grow EV is being developed for Hack4Vilnius 2026,
Challenge #13.

We want to help EV drivers choose better charging
options and help existing charging infrastructure
be used more efficiently.

## Main features

### Driver application

- Interactive charger map.
- Charger compatibility and availability.
- Charging alternatives.
- Traffic-aware route estimates.
- Explainable charger recommendations.

### Network intelligence

- Congestion detection.
- Nearby spare-capacity analysis.
- Unusual occupancy patterns.
- Infrastructure reliability signals.
- Proposed operational improvements.

## Technology

- Expo + React Native + TypeScript.
- MapLibre Native and MapLibre GL JS.
- PostgreSQL + PostGIS.
- Supabase.
- TypeScript application services.
- Python for analysis and ML.

See docs/ARCHITECTURE.md.

## Documentation

Start here:

- AGENTS.md — coding agent instructions.
- docs/PRODUCT.md — product and MVP.
- docs/ARCHITECTURE.md — technical architecture.
- docs/DATA_MODEL.md — data definitions.
- docs/INTELLIGENCE.md — algorithms.
- docs/DATA_SOURCES.md — external integrations.
- docs/API.md — application contracts.
- docs/DESIGN_SYSTEM.md — UI/UX.
- docs/TESTING.md — quality and testing.
- docs/DEMO_TRUTH.md — demo evidence.
- docs/DECISIONS.md — engineering decisions.
- docs/STATUS.md — current progress.

## Development status

See docs/STATUS.md for the current implementation state.

Documentation describes intended behavior.
Do not assume documented features are already implemented.

## Getting started

The driver application is in `apps/driver` and uses npm.

```powershell
cd apps/driver
npm install
npm run web
```

The web development server prints its local URL. To start the Android target,
connect a device or start an emulator, then run `npm run android`. Android
runtime verification depends on a locally configured Android SDK and was not
completed during the initial scaffold.

## Verification

Run these commands from `apps/driver`:

```powershell
npm run typecheck
npm run lint
npm run build:web
```

The production web export is written to `apps/driver/dist` and is ignored by
Git. These commands were verified for TASK-001 on 2026-10-09.

## Environment variables

Keep provider credentials outside Git.

Provide an `.env.example` containing variable
names and explanations, not secret values.

Privileged credentials must stay server-side.

## Development workflow

1. Read AGENTS.md.
2. Read docs/STATUS.md.
3. Choose an assigned task.
4. Read relevant technical documentation.
5. Implement and test.
6. Review changes.
7. Update task status.
8. Commit verified work.

## Demo

The intended hackathon demo includes:

- Public browser version accessible through a QR code.
- Native Android demonstration if ready.
- Real charger data.
- Explainable recommendations.
- Network intelligence dashboard.
- Clearly labeled simulation or fallback mode.

## Project principles

- Real data over invented data.
- Useful solutions over unnecessary complexity.
- Explainability over AI marketing.
- Privacy and security by design.
- Clean engineering.
- Strong user experience.

## License

License and public release policy have not yet
been selected.

Do not assume the repository or its components
are open source until a license is approved.
