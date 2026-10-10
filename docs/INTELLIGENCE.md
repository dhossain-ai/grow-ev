# Grow EV — Intelligence Engine

Status: TASK-006 deterministic congestion module implemented; approved DEV deployment blocked by connectivity
Version: 0.2

## Implemented first slice (TASK-006)

Driver details offer CCS2 (`IEC_62196_T2_COMBO`), Type 2 (`IEC_62196_T2`)
and CHAdeMO (`CHADEMO`). This single driver requirement is separate from map
connector/power discovery filters; alternatives do not promise a power threshold.
The new, not-yet-deployed `get_station_capacity(uuid)` RPC provides canonical
EVSE IDs, statuses, connector standards and individual observation times for the
selected station and nearby locations across operators. Station aggregates are
never used to infer compatible availability.

`apps/driver/src/features/map/congestion.ts` counts each compatible EVSE once.
AVAILABLE requires an observation no older than 60 minutes; missing/invalid/future
times cannot prove availability. This freshness ceiling matches the existing map
stale threshold and is a provisional demo policy, not a guarantee of arrival
availability. If any compatible observation is stale and none is freshly
AVAILABLE, current congestion is withheld. Otherwise congestion means zero
compatible AVAILABLE EVSEs and at least one CHARGING, BLOCKED or RESERVED EVSE.
UNKNOWN remains uncertainty; INOPERATIVE/OUTOFORDER/PLANNED/REMOVED alone are
not congestion. Mixed occupied/UNKNOWN states report the unknown count.

For fresh congestion, eligible alternatives must have at least one freshly
AVAILABLE EVSE with the exact connector standard. Search is independent of the
map viewport and operator, within 10 km great-circle distance of the selected
station. Rank nearest first, then more compatible available EVSEs at equal
distance, then canonical location ID; return at most three. UI explicitly labels
straight-line distance, shows the oldest observation supporting each available
count, and allows selection/recentering. No road distance, ETA, waiting estimate,
prediction, score, tariff or post-charge-idling inference is implemented.

The remaining sections describe future scope, not implemented capabilities.

## 1. Objective

Improve EV charging decisions and infrastructure efficiency.

The system should:

1. Understand current charger availability.
2. Identify local congestion and spare capacity.
3. Compare suitable charging options.
4. Recommend a useful action.
5. Explain why it was recommended.
6. Evaluate predictions and interventions.

Do not use an LLM as the main decision engine.

## 2. Inputs

### Charger information

- Location
- Operator
- EVSE status
- Connector type
- Rated charging power
- Tariff, if available
- Source freshness

### Driver information

- Current location
- Vehicle model or connector requirements
- Battery level, if supplied
- Desired charge/energy, if supplied
- Preference: fastest, cheapest or balanced
- Intended destination, if relevant

### Routing information

- Actual road route
- Estimated driving time
- Traffic awareness
- Detour time when a destination is known

### Historical information

- Status transitions
- Observed occupied periods
- Out-of-order patterns
- Congestion by time/day
- Source reliability

## 3. Processing pipeline

Live data
  -> Validation
  -> Candidate filtering
  -> Network analysis
  -> Routing
  -> Expected outcome estimates
  -> Recommendation
  -> Explanation

## 4. Candidate filtering

Exclude or deprioritize unsuitable options.

Check:
- Connector compatibility.
- Usable charging power.
- Station operating status.
- Road reachability.
- User-defined distance constraints.
- Data freshness.

A charger with UNKNOWN status must not be presented as confirmed available.

A nearby charger with an incompatible connector is not a valid alternative.

## 5. Network health metrics

### Observed occupancy ratio

Observed occupied duration divided by valid observed duration.

Only include periods that are sufficiently supported by data.

### Observed availability ratio

Observed available duration divided by valid observed duration.

### Unavailability ratio

Time in supported unavailable/out-of-order states divided by valid observed duration.

### Occupancy duration

Time between supported status transitions.

Use median and percentiles in addition to the mean.

Polling gaps create uncertainty.

Do not treat incomplete episodes as precise durations.

## 6. Congestion detection

### Distribution imbalance

Detect when one location is saturated while suitable nearby charging capacity exists.

Conditions to consider:

- Target station occupancy.
- Nearby compatible available EVSEs.
- Road travel time between locations.
- Similar charging power where relevant.
- Valid source freshness.

Output:

- Affected station.
- Nearby alternatives.
- Capacity evidence.
- Travel-time difference.
- Confidence/quality of evidence.

### Capacity shortage signal

Several nearby locations are simultaneously saturated.

This may indicate insufficient capacity.

It is not conclusive without historical demand evidence.

### Reliability issue signal

Unavailable or unstable EVSE statuses may reduce usable capacity.

### Possible long-occupancy signal

Observed occupied durations are unusually long compared with a suitable baseline.

This is not proof of post-charge blocking.

## 7. Routing

Routing provider is accessed through a separate adapter.

The routing service returns:
- Distance by road.
- Estimated driving duration.
- Traffic-aware duration if supported.
- Route geometry when needed.
- Provider and calculation timestamp.

Use TomTom as the initial traffic-aware candidate.

Fallback to a traffic-free routing service if needed.

If traffic data is absent, clearly label the ETA as an estimate without live traffic.

Do not use straight-line distance as a substitute for road ETA.

## 8. Expected total journey time

For a charging stop:

Total time =
  Driving time
  + Expected waiting time
  + Expected charging time
  + Relevant additional stop overhead

If continuing to another destination:

Add the remaining route/detour effects.

If an input is unknown, do not fabricate precise values.

### Expected waiting time

Initially:
- Use current status.
- Use nearby capacity.
- Use available historical baselines.
- Show uncertainty.

If there is insufficient data, display uncertainty rather than a made-up wait time.

### Expected charging time

Depends on:
- Requested energy.
- Battery state.
- Vehicle charging capability.
- Charging curve.
- Charger capability.

Rated charger power is not the same as constant real charging power.

Use conservative estimates if detailed vehicle data is unavailable.

## 9. Recommendation logic

First apply hard constraints:
- Compatibility.
- Reachability.
- Status/data validity.

Then compare eligible candidates using:
- Expected total time.
- Charging price.
- Travel distance or detour.
- Availability risk.
- Reliability signals.
- User preferences.

Use an explainable scoring or ranking method.

Start with deterministic rules and simple weighted costs.

Keep an internal score separate from calibrated probabilities.

A score of 90/100 must not be presented as a 90% probability of successful charging.

## 10. Network-balancing objective

Driver benefit comes first.

If two choices are similar for the driver, prefer the option that also makes better use of spare network capacity.

Do not significantly worsen a driver's journey merely to improve an operator's utilization score.

Recommendation explanations must be transparent.

## 11. Availability prediction

Initial baseline:
- Current EVSE status.
- Historical transitions.
- Hour of day.
- Day of week.
- Comparable charger patterns.

Potential later models:
- Empirical conditional probabilities.
- Survival analysis.
- Logistic regression.
- Gradient-boosted trees.

Training must use chronological splits, not random leakage from the future.

Evaluate against simple baselines.

Report prediction uncertainty and sample coverage.

If no valid history exists, do not show an unsupported probability.

## 12. Grow Score

Grow Score is a proposed product-facing summary, not yet a fixed formula.

Possible components:
- Vehicle suitability.
- Current availability.
- Arrival availability estimate.
- Charging time.
- Travel time.
- Price.
- Historical reliability.
- Network-balancing benefit.

Before implementation, define:
- Score meaning.
- Normalization.
- Weights.
- Missing-data handling.
- User preference behavior.
- Explanation format.
- Test cases.

Do not independently invent scoring formulas in frontend components.

The first recommendation engine may rank actual estimated outcomes without showing a Grow Score.

## 13. Intervention engine

Possible actions:
- Suggest another suitable station.
- Warn about congestion.
- Encourage responsible charger turnover.
- Recommend checking unusually long occupancy.
- Simulate demand redistribution.

Real session-completion reminders and rewards require suitable user/operator integrations.

## 14. Simulation

A simulation may model:
- Drivers changing station choice.
- Demand spread across nearby stations.
- Potential reduction in waiting.
- Changes in local utilization.

Simulated outcomes must be labeled.

Do not claim simulated effects are measured real-world results.

## 15. Evaluation

Compare Grow EV against:
- Nearest compatible charger.
- Nearest currently available charger.
- Cheapest known option.
- Basic status-only recommendation.

Metrics may include:
- Correct compatibility filtering.
- Recommendation consistency.
- Expected versus observed outcomes.
- Availability prediction calibration.
- Estimated journey time.
- Simulated network distribution.

Real user success requires later field testing.

## 16. Key principle

The system must be able to answer:

"Why did you recommend this charger?"

with actual evidence and calculations.

An LLM may explain validated results in the future, but it must not invent or independently decide the result.
