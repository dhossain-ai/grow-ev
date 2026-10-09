# Grow EV — Agent Instructions

This file is the main instruction source for all AI coding agents.

## Project

Grow EV is an EV charging intelligence platform.

For drivers:
Help them choose suitable chargers, reduce unnecessary waiting, and make better charging decisions.

For operators and city planners:
Detect congestion, underused capacity, unusual occupancy and opportunities to improve infrastructure use.

Official hackathon focus: Hack4Vilnius 2026, Challenge #13.

## Before starting a task

1. Read `docs/STATUS.md`.
2. Read the assigned task description.
3. Read only the relevant documents under `docs/`.
4. Inspect existing implementations before writing code.
5. Ask for clarification if an important requirement is missing.

Do not read the entire documentation folder for every task.

## Technology

- TypeScript for application code.
- Expo + React Native for the universal driver app.
- Expo Router for navigation.
- MapLibre Native for mobile maps.
- MapLibre GL JS for browser maps.
- Supabase PostgreSQL + PostGIS.
- TypeScript Edge Functions for application services.
- Python for analysis, experiments and ML.
- Cloudflare for web deployment where suitable.

See `docs/ARCHITECTURE.md` for details.

## Coding rules

- Prefer simple, correct, maintainable solutions.
- Follow existing patterns and naming.
- Use strict TypeScript and explicit types.
- Keep domain logic separate from UI.
- Do not introduce new frameworks without approval.
- Do not rewrite unrelated modules.
- Do not hardcode secrets or API keys.
- Validate external data at system boundaries.
- Handle missing, stale and invalid data safely.
- Keep API contracts consistent.
- Add tests for nontrivial logic.

## AI and data integrity

- Do not invent real-time charger information.
- Do not present simulated results as live measurements.
- Do not present heuristic scores as calibrated probabilities.
- Distinguish observed occupancy from confirmed post-charge idling.
- Do not claim model accuracy without evaluation.
- Prefer explainable algorithms before unnecessary ML complexity.

## Working with other agents

- Work only within the assigned task scope.
- Avoid modifying files owned by parallel tasks.
- Do not overwrite another agent's changes.
- Use small, reviewable changes.
- Report assumptions and unresolved issues.

## Before finishing

1. Run relevant tests and type checks.
2. Report passed, failed and unrun checks.
3. Update the assigned task status.
4. Update `docs/STATUS.md` if the project state changed.
5. Summarize changed files and next steps.
6. Do not claim completion if acceptance criteria are unmet.

## Documentation rules

Documentation must describe actual decisions and current implementation.

Use:
- `PRODUCT.md` for product scope.
- `ARCHITECTURE.md` for technical structure.
- `DATA_MODEL.md` for data meaning and schema.
- `INTELLIGENCE.md` for algorithms.
- `DECISIONS.md` for important technical decisions.
- `STATUS.md` for current progress.

Avoid duplicate or contradictory documentation.

## Important

Grow EV is intended to become a real product, not only a hackathon demonstration.

However, build and validate the smallest useful implementation before expanding scope.


## Code Quality and Handoff

Prefer the smallest maintainable implementation that
satisfies the task.

- Do not create unnecessary abstractions.
- Do not add dependencies without a real need.
- Do not create generic frameworks for one use case.
- Do not duplicate code or business logic.
- Do not introduce speculative future features.
- Do not rewrite working code without justification.
- Remove dead code and unused imports.
- Do not hide errors with fallback values.
- Do not claim tests passed unless executed.

Before finishing, review your own changes and simplify
unnecessary complexity.

Keep the final handoff under 200 words:

1. Implemented: what actually works.
2. Files changed: paths and purpose.
3. Tests: commands and actual results.
4. Decisions: important trade-offs.
5. Limitations: incomplete or unverified behavior.
6. Next: recommended follow-up, if needed.

Do not start another task automatically.