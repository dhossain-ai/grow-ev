# Grow EV — Demo Truth and Evidence

Version: 0.1
Status: Hackathon demonstration policy

## 1. Purpose

Ensure all displayed information is accurately described.

Grow EV combines:
- External live data.
- Derived calculations.
- Historical statistics.
- Predictions.
- Simulated scenarios.

These must not be confused with each other.

## 2. Evidence categories

### LIVE / OBSERVED

Information obtained from an actual data source.

Examples:
- Current published EVSE status.
- Current published station location.
- Current published connector power.

Requirements:
- Show source.
- Show observation time.
- Check freshness.

A recently fetched status is not necessarily
a guarantee of physical availability.

### DERIVED

Information calculated from observed data.

Examples:
- Current percentage of usable EVSEs.
- Nearby available compatible capacity.
- Historical median occupied duration.

Requirements:
- Explain calculation.
- Identify underlying inputs.
- Include relevant observation window.

### ESTIMATED

An estimate based on assumptions or models.

Examples:
- Expected waiting time.
- Expected charging duration.
- Availability at arrival.

Requirements:
- Show uncertainty where possible.
- Identify model or method.
- Avoid unsupported precision.

### SIMULATED

Results from a hypothetical situation.

Examples:
- Redirecting ten drivers.
- Estimated impact of incentives.
- Alternative future congestion patterns.

Requirements:
- Clearly label "Simulation".
- Explain the scenario.
- Do not claim real measured improvement.

### MOCK / DEMO DATA

Manually constructed demonstration input.

Requirements:
- Label clearly.
- Do not mix invisibly with live measurements.
- Avoid making mock locations appear to be
  verified real infrastructure.

### PLANNED

A future feature or integration.

Examples:
- Real operator-funded rewards.
- Session-completion detection.
- Unified payment.
- Operator integration.

Do not demonstrate these as deployed features.

## 3. Critical forbidden claims

Never claim:

"Grow EV knows when a car finished charging."

unless authorized session/vehicle data supports it.

Never claim:

"This charger will be available in 10 minutes."

unless properly presented as an estimate.

Never claim:

"Grow EV reduced congestion by 30%."

if the result came from a simulation.

Never claim:

"Our AI has 95% accuracy."

without a valid evaluation.

Never claim:
"All Lithuanian networks are included."

without verified coverage evidence.

## 4. Live data demonstration

Preferred:
Use current Via Lietuva data and show timestamps.

Fallback:
Use the latest cached snapshot.

If fallback is used, show:
"Historical snapshot" and its capture time.

If a simulated scenario is also shown,
keep it visually distinct.

## 5. Judge questions

### How do you know this is real?

Show the source, timestamp and data pipeline.

### How do you know this recommendation is better?

Show the alternatives, assumptions,
travel-time estimates and calculation.

### Can you detect finished-but-blocking cars?

Not reliably with public status alone.
We can detect unusual observed occupancy.
True confirmation requires suitable operator/session data.

### Did your system improve station efficiency?

If not measured with real users, say:
"We modeled the potential impact in a simulation."

### Where does AI help?

Use statistical prediction where supported.
Do not claim an LLM makes infrastructure decisions.

## 6. Demo modes

### Live mode

Uses current external information.

### Snapshot mode

Uses previously captured real information.

### Simulation mode

Uses hypothetical driver demand and interventions.

Make the active mode visible.

## 7. Evidence checklist

Before presenting:

[ ] Live-data source identified
[ ] Source freshness visible
[ ] Derived calculations reproducible
[ ] Predictions distinguished from facts
[ ] Simulations clearly labeled
[ ] API limitations understood
[ ] No invented measured impact
[ ] No unsupported model accuracy
[ ] Fallback demo available
[ ] Team can explain the main algorithm

## 8. Main principle

An honest prototype with real calculations
is stronger than a misleading demo with
impressive-looking numbers.