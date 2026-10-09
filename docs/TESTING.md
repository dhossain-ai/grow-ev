# Grow EV — Testing and Quality

Version: 0.1
Status: Proposed quality standards

## 1. Philosophy

Working code is more important than code that
only appears correct.

Every meaningful implementation should be tested.

Do not claim that a test passed unless it was run.

## 2. Recommended testing tools

TypeScript:
- Vitest for pure logic and utility tests.

React Native:
- React Native Testing Library where suitable.

Web:
- Playwright for important user flows.

Python:
- pytest for data processing and ML tests.

Database:
- Migration checks and SQL-level tests.

These are recommended tools.
Install only what the project needs.

## 3. Testing levels

### Unit tests

Test small pieces of logic independently.

Examples:
- Connector compatibility.
- Price calculations.
- Data freshness.
- Status normalization.
- Recommendation ranking.
- Occupancy metrics.

### Integration tests

Test interactions between services.

Examples:
- External data -> parser -> database.
- Database -> network metrics.
- Routing provider -> normalized route response.
- Recommendation engine -> API response.

### End-to-end tests

Test major user journeys.

Examples:
- Open app.
- Load charger map.
- Select vehicle preferences.
- View recommended charger.
- Compare alternatives.
- Inspect recommendation explanation.

## 4. Critical data test cases

- Missing station coordinates.
- Invalid coordinates.
- Duplicated EVSE identifiers.
- Duplicate status observations.
- Status changed from AVAILABLE to CHARGING.
- Status changed from CHARGING to AVAILABLE.
- Unknown status.
- Out-of-order status.
- Stale source.
- Provider timeout.
- Feed returns incomplete data.
- Source timestamp differs from observation timestamp.

Do not count multiple connectors of one EVSE
as independently available charging spaces
unless the source explicitly supports this.

## 5. Critical recommendation tests

- Incompatible connectors are excluded.
- Out-of-order chargers are not recommended
  as confirmed usable.
- Traffic route time is correctly used.
- Straight-line distance is not called driving time.
- User preference changes rankings appropriately.
- Unknown price is handled safely.
- Missing prediction does not produce fake confidence.
- Network balancing does not significantly harm
  the driver's expected outcome.
- Recommendation explanation matches the calculation.

## 6. Critical ML tests

- Chronological train/test separation.
- No future-information leakage.
- Correct feature meanings.
- Baseline comparison.
- Calibration where probabilities are shown.
- Handling of insufficient history.
- Reproducible training configuration.

Do not promote a complex model unless it
demonstrably improves an appropriate baseline.

## 7. Map and UI tests

Test:
- Map loads.
- Markers are visible.
- Station selection works.
- Bottom sheets open and close.
- Recommendation cards display.
- Loading and error states.
- No-location-permission state.
- Different screen sizes.
- Browser and Android behavior.
- Keyboard accessibility on web.

Native map performance must be tested on a real device.

## 8. Browser demo tests

Open the public URL on:
- Android browser.
- iPhone browser if available.
- Desktop Chrome.
- Another major browser if possible.

Verify:
- No login required for guest demo.
- QR link works.
- Map renders.
- Real data or labeled fallback loads.
- Recommendation works.
- Errors are handled clearly.

## 9. Security tests

Check:
- No service-role keys in frontend bundles.
- No credentials committed to Git.
- Input validation.
- Restricted operator endpoints.
- Database access controls.
- Report-submission abuse prevention.
- Sensitive data not exposed through logs.

## 10. Performance tests

Measure:
- Initial load time.
- Map interaction smoothness.
- Recommendation response time.
- Number of external routing calls.
- Database query latency.
- Mobile memory behavior.

Establish specific performance budgets
after measuring the first working implementation.

## 11. Before accepting an agent's work

The agent must report:

- Files changed.
- Feature implemented.
- Tests added.
- Tests executed.
- Passed/failed results.
- Known limitations.
- Unverified assumptions.

Do not accept:
"Everything works."

Require evidence.

## 12. Testing when external APIs fail

Use controlled test fixtures.

Fixtures must be explicitly marked test data.

Integration tests should not depend on
a production API being online every time.

Separately run live-source smoke tests.

## 13. Completion criteria

A task is complete when:

1. Its acceptance criteria are satisfied.
2. Relevant tests pass.
3. No unrelated functionality is broken.
4. Type checks pass where applicable.
5. Documentation is updated when needed.
6. Remaining limitations are reported.

A feature is not complete merely because
its UI exists.