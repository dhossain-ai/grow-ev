# Grow EV — Product Specification

Status: Initial product definition
Version: 0.1
Challenge: Hack4Vilnius 2026 — #13

## 1. Vision

Grow EV helps EV drivers make better charging decisions and helps cities and charging operators use existing charging infrastructure more efficiently.

Our focus is not simply showing chargers on a map.

We want to help drivers decide where to charge, understand network congestion, and identify actions that improve charging availability.

## 2. Main problem

Public charging infrastructure is not always used efficiently.

Problems include:

1. One charging station is full while nearby compatible chargers are available.
2. Drivers may arrive at chargers that are no longer available.
3. Some stations show unusually long occupancy patterns.
4. Drivers cannot easily compare total travel, waiting and charging time.
5. Unreliable chargers reduce usable infrastructure capacity.
6. Operators and city planners need better cross-network visibility.

## 3. Target users

### EV drivers

Want to:
- Find suitable working chargers.
- Avoid unnecessary waiting.
- Choose based on time, price and vehicle compatibility.
- Understand why a recommendation is useful.
- Report incorrect information or blocked infrastructure.

### Charging operators

Want to:
- Understand station utilization.
- Identify congestion and long occupancy.
- Detect unusual behavior patterns.
- Understand nearby alternatives and local demand.
- Evaluate possible interventions.

### City planners

Want to:
- Understand city-wide charging demand.
- Identify geographic infrastructure gaps.
- Separate insufficient capacity from uneven demand.
- Make better evidence-based infrastructure decisions.

## 4. Core product

Grow EV has two interfaces.

### Driver app

A map-first mobile and web experience.

Core capabilities:

- Display current charging stations.
- Show current availability and station details.
- Filter by connector, power and other relevant factors.
- Calculate actual driving routes to candidate stations.
- Recommend charging options.
- Explain recommendation trade-offs.
- Offer alternatives to congested stations.
- Display source freshness and uncertainty.

### Network intelligence dashboard

A browser-based operational view.

Core capabilities:

- Map charger availability across Vilnius.
- Identify saturated locations.
- Find compatible spare capacity nearby.
- Compare observed usage patterns.
- Highlight unusual occupancy and reliability signals.
- Explain the evidence behind alerts.
- Demonstrate possible demand redistribution.

## 5. Core user story

A driver needs to charge.

Their usual station is full.

Grow EV identifies another suitable station that:
- Has currently available capacity.
- Is reachable by road.
- Supports the driver's vehicle.
- May reduce total charging journey time.

Grow EV explains the recommendation.

At the same time, the network dashboard identifies the imbalance between the two locations.

## 6. What makes us different

Charger maps, price comparison and routing already exist.

Our proposed differentiation is combining:

- Cross-network infrastructure information.
- Historical charger status.
- Driver-specific decisions.
- Traffic-aware driving time.
- Congestion and nearby capacity analysis.
- Explainable recommendations.
- Possible behavior interventions.

This differentiation is a product hypothesis, not a proven market advantage.

## 7. Hackathon MVP

Priority 0 — must work:

1. Real charger-data ingestion.
2. Correct station/EVSE/connector representation.
3. Interactive map of Vilnius.
4. Availability and compatibility filtering.
5. Nearby spare-capacity detection.
6. Road-route comparison.
7. Explainable driver recommendation.
8. Simple network dashboard.

Priority 1 — if time permits:

- Historical occupancy analysis.
- Reliability indicators.
- Basic availability estimation.
- Wait-versus-reroute comparison.
- Intervention simulation.
- Community problem reporting.

Priority 2 — future:

- Verified post-charge idle detection.
- Operator-triggered reminders.
- Real rewards and discounts.
- Charging-session integrations.
- Unified charging payments.
- Advanced fleet optimization.
- European expansion.

## 8. Non-goals for the initial version

We will not attempt to:

- Process charging payments.
- Control third-party chargers.
- Build a complete navigation engine.
- Guarantee station availability.
- Detect charging completion without supporting data.
- Replace operator charging-management systems.
- Train a large language model.
- Build every EV ownership feature.

## 9. Success criteria

Hackathon success:

- Uses real infrastructure data.
- Correctly identifies at least one meaningful network situation.
- Gives an evidence-based recommendation.
- Shows the driver's and city's perspectives.
- Distinguishes real data from simulations.
- Works on a public browser demo.
- Demonstrates on Android if the native build is ready.

Long-term success should be measured through:

- Recommendation acceptance.
- Successful charging outcomes.
- Waiting time compared with alternatives.
- Prediction calibration.
- Reliability of reported infrastructure status.
- Verified changes in congestion or utilization.

Do not claim real-world improvements without measurements.

## 10. Product principle

Grow EV should answer:

"Where should I charge, and why?"

For infrastructure stakeholders:

"What is inefficient here, and what could improve it?"