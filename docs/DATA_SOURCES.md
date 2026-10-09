# Grow EV — Data Sources

Version: 0.1
Status: Source registry and integration plan

## 1. Purpose

Document external data providers, their intended use,
limitations, attribution and integration requirements.

Do not assume a provider supports an API field or feature
until it has been verified through documentation and tests.

## 2. Primary charging data

Provider:
Via Lietuva national EV charging data system.

Website:
https://ev.vialietuva.lt/

Official open-data documentation:
https://ev.vialietuva.lt/atviri-duomenys-1

Published OCPI locations endpoint:
https://ev.vialietuva.lt/ocpi/2.3.0/locations

Published DATEX II endpoints:
https://ev.vialietuva.lt/publicdata/EnergyInfrastructureTablePublication
https://ev.vialietuva.lt/publicdata/EnergyInfrastructureStatusPublication

### Purpose

Use for:
- Station locations.
- EVSE and connector information.
- Operator identification.
- Charging power.
- Published status information.
- Other validated supported fields.

### Important limitations

Do not assume:
- All stations provide complete tariffs.
- Every operator has identical data quality.
- A status identifies the exact charging-session phase.
- Long occupancy proves a finished vehicle is blocking.
- Every published update reaches the feed instantly.
- Every connector can be used simultaneously.

Inspect actual OCPI objects before designing the parser.

### License

The official portal publishes the open data under
CC BY 4.0 / ODC-BY terms.

Preserve:
- Source attribution.
- License link.
- Modification notice where required.

Review the current license before production deployment.

## 3. Live traffic-aware routing

Initial provider candidate:
TomTom Routing API.

Documentation:
https://docs.tomtom.com/routing-api/

Pricing:
https://www.tomtom.com/products/maps-api/pricing/

### Intended use

Calculate:
- Road distance.
- Driving duration.
- Traffic-aware ETA.
- Route geometry.
- Alternative routes where supported.

### Integration

Build a routing provider adapter.

Example interface:

getRoute(origin, destination, options)

Return normalized:
- distanceMeters
- durationSeconds
- trafficAware
- geometry
- provider
- calculatedAt

### Limitations

Before implementation verify:
- Account activation.
- Current free allowance.
- Billing requirements.
- Supported endpoints.
- Rate limits.
- Terms for caching route results.
- Attribution and display requirements.
- Traffic coverage in Vilnius.

Do not hardcode free-tier request counts in the app.

Do not label an ETA traffic-aware unless the provider
actually supplied traffic-aware information.

## 4. Routing fallback

Provider:
openrouteservice

Documentation:
https://openrouteservice.org/

### Purpose

Provide road routing when TomTom is unavailable
or traffic-aware routing cannot be used.

### Limitation

Treat the initial fallback as traffic-free routing.

Check account quotas and API base URL.
Do not use deprecated endpoints.

Never invent a fallback journey duration.

If no route is available, return an explicit error
or mark the candidate as unverified.

## 5. Map rendering and tiles

Renderer:
MapLibre

Website:
https://maplibre.org/

Potential basemap:
OpenFreeMap

Documentation:
https://openfreemap.org/

### Important

MapLibre is a renderer, not a traffic-routing service.

OpenFreeMap provides map styles and tiles,
not the charging decision algorithm.

Review the tile provider's current terms,
attribution and availability.

Do not remove OpenStreetMap or required map attribution.

Prefer configurable style URLs.

## 6. Vilnius transport and traffic context

Provider:
JUDU

Open data:
https://judu.lt/atviri-duomenys/

Vilnius data portal:
https://opendata.vilnius.lt/

### Possible useful information

- Traffic flow.
- Congestion.
- Road incidents.
- Road restrictions.
- Transport infrastructure.

### Status

Potential additional source.

The availability of a suitable documented API
for integration must be verified.

JUDU public visualization links are not automatically
an API that can calculate arbitrary driving routes.

Do not scrape internal visualization endpoints without
checking permission and terms.

## 7. Vehicle information

Potential future data:
- Vehicle model.
- Supported connector types.
- Battery capacity.
- Typical charging capability.
- Charging curves.

Initial strategy:

Use a small manually verified vehicle catalog
with source references.

Allow manual connector selection.

Do not infer exact charging time solely from
the charger's maximum advertised power.

## 8. Community reports

Grow EV may collect:
- Incorrect station status.
- Charger out of order.
- Blocked access.
- Payment problem.
- Damaged equipment.
- Other user observations.

Community reports are claims, not verified facts.

Store:
- Report category.
- Station reference.
- Creation time.
- Verification state.
- Optional evidence.

Provide moderation and abuse protection.

Do not publish identifying vehicle/driver information
without a lawful basis and appropriate privacy controls.

## 9. Internal historical data

Grow EV will create its own history by observing
public status updates.

Store:
- Source EVSE identifier.
- Previous and new statuses.
- Observation timestamp.
- Source timestamp when available.
- Data-quality information.

Use this history to calculate:
- Occupancy duration estimates.
- Availability patterns.
- Unavailable periods.
- Repeated congestion.
- Data freshness.

Observed state is not proof of delivered energy.

## 10. Source freshness

Each current status must include:
- Source name.
- Observation time.
- Source update time when available.
- Freshness classification.

Possible freshness classes:
- fresh
- stale
- unknown

Thresholds will be defined from real observations.

Do not silently treat stale statuses as live.

## 11. API security

- Keep privileged keys server-side.
- Store keys in environment variables or secret stores.
- Never commit keys to Git.
- Apply request quotas and caching where appropriate.
- Validate external responses.
- Handle rate limits.
- Record provider failures.
- Avoid leaking user locations into unnecessary logs.

## 12. Data-source verification checklist

For each source confirm:

[ ] Official documentation
[ ] Working access
[ ] Authentication requirements
[ ] Example response saved as a fixture
[ ] Field meanings verified
[ ] Usage and rate limits
[ ] License and attribution
[ ] Timestamp behavior
[ ] Missing-data behavior
[ ] Error handling
[ ] Provider fallback if necessary

## 13. Source priorities

P0:
- Via Lietuva charger data.
- MapLibre and a working basemap.
- Actual road routing.

P1:
- Historical observations.
- Traffic-aware routing.
- Verified tariff information.

P2:
- JUDU supplemental traffic context.
- Detailed vehicle charging curves.
- Charging operator integrations.
- Advanced user-generated data.

## 14. Source integrity

All external information must be traceable.

Do not replace missing source fields with invented values.

Every derived result should identify enough source
and calculation information to be investigated.

Source data should remain separable from:
- Calculated results.
- Predictions.
- Simulated scenarios.