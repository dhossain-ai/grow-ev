# Grow EV — Data Model

Status: Proposed logical schema
Version: 0.1

This document defines the meaning of our data.

The first database migration must be reviewed before implementation.

## 1. Main entities

### operators

Represents charging network operators.

Fields:
- id
- name
- external_identifiers
- website (optional)

### stations

Represents physical charging locations.

Fields:
- id
- source_id
- operator_id
- name
- address
- latitude
- longitude
- location (PostGIS geography/geometry)
- last_source_update

### evses

Represents individual EV supply equipment units.

Fields:
- id
- station_id
- source_evse_id
- current_status
- status_updated_at
- last_observed_at
- source_name

Status belongs to the EVSE according to the source model.

Do not assume every connector is an independently usable charging space.

### connectors

Fields:
- id
- evse_id
- connector_type
- power_kw
- current_type
- voltage (optional)
- amperage (optional)

An EVSE may expose several connector types without supporting simultaneous independent charging.

### status_events

Records observed status transitions.

Fields:
- id
- evse_id
- previous_status
- new_status
- source_updated_at (nullable)
- observed_at
- source_name

An observation timestamp and a source timestamp are not always the same.

### status_observations

Optional raw or sampled observations for audit and analysis.

Avoid unlimited duplicate snapshots.

### occupancy_episodes

Derived observed occupancy periods.

Fields:
- id
- evse_id
- started_at
- ended_at (nullable)
- duration_seconds (nullable)
- confidence / quality flag
- incomplete_start
- incomplete_end

These episodes are inferred from status transitions.

They are not proof that energy was flowing for the entire period.

### tariffs

Fields:
- id
- station_id or connector relation
- operator_id
- tariff_id
- currency
- pricing_structure
- valid_from
- last_updated

Do not assume every tariff is a simple price per kWh.

Some tariffs may include time, parking, session or membership charges.

### station_metrics

Derived measurements such as:
- observed availability ratio
- observed occupied ratio
- unavailable ratio
- average occupied duration
- status freshness
- nearby usable capacity
- calculation window
- sample count

### vehicles

Fields:
- id
- make
- model
- battery_capacity_kwh
- supported_connectors
- charging_capabilities
- charging_curve_reference (optional)

Vehicle data must identify the source and avoid inaccurate assumptions.

### recommendations

Fields:
- id
- created_at
- anonymous/session user reference
- selected_station_id
- considered_stations
- evidence
- recommendation_version
- predicted_metrics
- user_preference

### problem_reports

Fields:
- id
- station_id
- report_type
- description (optional)
- evidence reference (optional)
- created_at
- verification_status

Community reports are unverified until corroborated.

## 2. EVSE status handling

Normalize source statuses carefully.

Examples may include:
- AVAILABLE
- CHARGING
- BLOCKED
- RESERVED
- INOPERATIVE
- OUTOFORDER
- UNKNOWN
- PLANNED
- REMOVED

Preserve the original source status where useful.

UNKNOWN must not mean AVAILABLE.

BLOCKED must not automatically mean confirmed post-charge idling.

## 3. Ingestion rules

1. Fetch data according to source limits.
2. Validate required fields.
3. Normalize external identifiers.
4. Upsert current state.
5. Write a status event only for a real transition.
6. Preserve observed and source timestamps separately.
7. Avoid duplicate history events.
8. Do not erase the last known good state because one response is malformed.
9. Mark old observations as stale.
10. Log errors and unusual feed behavior.

## 4. Data freshness

A currently stored status is not necessarily live.

Each EVSE needs:
- Last successful observation.
- Source update time where provided.
- Freshness classification.

Freshness thresholds must be configurable and tested against real feed behavior.

Stale status must not be advertised as confirmed current availability.

## 5. Geographic data

Use PostGIS for:
- Nearby station searches.
- Radius calculations.
- Geographic clustering.
- Area-based capacity analysis.

Use actual road routing APIs for driving time.

Straight-line distance must not be labeled driving distance.

## 6. Data quality

Track:
- Missing coordinates.
- Invalid coordinates.
- Duplicate source identifiers.
- Missing power values.
- Missing or ambiguous tariffs.
- Unusual status transitions.
- Stale observations.
- Data-source failures.

Missing information should remain missing, not silently become zero.

## 7. Privacy

Do not collect personal location history unless required and justified.

For guest recommendations, prefer short-lived session data.

Apply access controls to user reports and operator data.

Never expose service-role credentials to the mobile or browser client.