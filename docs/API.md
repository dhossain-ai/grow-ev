# Grow EV — API Contract

Version: 0.1
Status: Proposed, not yet implemented

## 1. Purpose

Provide consistent interfaces for:

- Driver application.
- Browser application.
- Operator dashboard.
- Grow EV intelligence services.

All clients must use the same domain definitions.

## 2. General conventions

API base path:

/v1

Use:
- HTTPS.
- JSON.
- ISO 8601 timestamps with timezone.
- Coordinates in WGS84.
- Distances in meters.
- Durations in seconds.
- Charging power in kW.
- Energy in kWh.
- Currency as ISO currency codes.

Use consistent camelCase JSON properties.

Unknown numeric values must be null or absent,
not invented or silently converted to zero.

## 3. API response integrity

Every returned measurement should identify its type:

- observed
- derived
- estimated
- simulated

Information should include relevant timestamps.

Never present heuristic scores as probabilities.

Never present a stale status as confirmed live.

## 4. Public endpoints

### GET /v1/stations

Purpose:
Find charging stations around a location.

Query parameters:
- lat: number, required
- lng: number, required
- radiusMeters: number, optional
- connectorTypes: optional
- minPowerKw: optional
- availability: optional
- limit: optional

Response:

{
  "stations": [
    {
      "id": "station-example",
      "name": "Example Station",
      "operatorName": "Example Operator",
      "location": {
        "lat": 54.68,
        "lng": 25.28
      },
      "availableEvses": 2,
      "totalEvses": 4,
      "availabilityQuality": "observed",
      "observedAt": "2026-10-09T12:00:00Z",
      "freshness": "fresh"
    }
  ]
}

Example values are illustrative, not actual feed results.

### GET /v1/stations/{stationId}

Purpose:
Return detailed station information.

Includes:
- Station identification.
- Operator.
- Location.
- EVSEs and connectors.
- Current status.
- Source freshness.
- Tariffs where verified.
- Supported derived metrics.

Different EVSEs must remain separately identifiable.

### POST /v1/recommendations

Purpose:
Calculate suitable charger recommendations.

Request:

{
  "origin": {
    "lat": 54.68,
    "lng": 25.28
  },
  "vehicle": {
    "connectorTypes": ["CCS2"],
    "maxDcPowerKw": 150
  },
  "batteryPercent": 25,
  "targetBatteryPercent": 70,
  "preference": "fastest"
}

All vehicle and battery fields should be optional
where a useful fallback is available.

Supported preferences:
- fastest
- cheapest
- balanced

Optional destination:
- destination coordinates

Response should include:
- Ranked alternatives.
- Compatibility evidence.
- Driving distance/time.
- Traffic-awareness flag.
- Current availability.
- Source freshness.
- Price when verified.
- Expected charging time if supported.
- Recommendation reasons.
- Assumptions and limitations.

Example recommendation structure:

{
  "recommendations": [
    {
      "stationId": "station-example",
      "rank": 1,
      "driveTimeSeconds": 420,
      "trafficAware": true,
      "availability": "AVAILABLE",
      "expectedWaitSeconds": null,
      "estimatedTotalSeconds": null,
      "score": null,
      "reasons": [
        "Currently available",
        "Compatible connector"
      ]
    }
  ],
  "generatedAt": "2026-10-09T12:00:00Z"
}

The example does not establish the final schema.

Never fill unknown estimates with fabricated values.

### GET /v1/network/overview

Purpose:
Return network-wide operational summary.

Data may include:
- Station count.
- EVSE count.
- Current observed availability.
- Unavailable/unknown counts.
- Data freshness.
- Geographic breakdown.

Each aggregate must identify its calculation window.

### GET /v1/network/imbalances

Purpose:
Find locations with saturation and compatible
spare charging capacity nearby.

Possible response:
- Saturated station.
- Compatible nearby alternatives.
- Relevant driving-time differences.
- Evidence.
- Classification.
- Confidence/data-quality information.

### POST /v1/reports

Purpose:
Submit community problem reports.

Requires:
- Input validation.
- Abuse prevention.
- Rate limiting.
- Moderation workflow.

Reports must not automatically become verified facts.

## 5. Restricted endpoints

### POST /v1/simulations/redistribution

Purpose:
Run hypothetical charging-demand redistribution scenarios.

Access:
Demo/admin/operator role as appropriate.

Results must be marked as simulated.

### Operator-specific endpoints

May require:
- Authentication.
- Organization membership.
- Role-based authorization.

Never expose private operator information publicly
without permission.

## 6. Error format

Standard error structure:

{
  "error": {
    "code": "ROUTING_UNAVAILABLE",
    "message": "Driving route is temporarily unavailable",
    "retryable": true
  }
}

Possible error codes:
- INVALID_INPUT
- STATION_NOT_FOUND
- NO_COMPATIBLE_CHARGERS
- SOURCE_STALE
- ROUTING_UNAVAILABLE
- EXTERNAL_RATE_LIMITED
- UNAUTHORIZED
- FORBIDDEN
- INTERNAL_ERROR

Provide clear messages and predictable error types.

## 7. Pagination and limits

List endpoints must support bounded results.

Use pagination or cursors where needed.

Never return the entire national dataset on every
mobile screen refresh.

## 8. API security

- Validate all incoming data.
- Rate-limit public endpoints.
- Keep API credentials server-side.
- Use appropriate database access policies.
- Avoid exposing privileged Supabase keys.
- Do not log unnecessary personal location data.
- Separate public and restricted operations.

## 9. Provider adapters

Application clients should not call every external
data provider directly.

Use backend adapters for:
- Via Lietuva data ingestion.
- TomTom routing.
- Routing fallback.
- Internal intelligence calculations.

Expose normalized Grow EV contracts to clients.

## 10. Contract ownership

The API schema is the source of truth for
client/server communication.

Prefer generating TypeScript types from a
machine-readable schema such as OpenAPI or Zod
once endpoints are implemented.

Do not maintain conflicting manually written
request/response definitions.

Update this document and associated tests
when an API contract changes.