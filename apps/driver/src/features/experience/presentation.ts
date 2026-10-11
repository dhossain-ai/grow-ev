import { geographicDistanceMeters, isCoordinates, isDrivingRoute, sameCoordinates, ROUTE_MAX_AGE_MS, type RouteOutcome, type Coordinates } from '../../../../../packages/routing';
import { compatibleCapacity, FRESHNESS_MS, type ConnectorStandard, type StationEvidence } from '../map/congestion';
import { formatConnector, type MapStation } from '../map/types';

export function stationTitle(station: MapStation) { return station.name || station.address || 'Charging station'; }
export function connectorKind(standard: ConnectorStandard) { return standard === 'IEC_62196_T2' ? 'AC charging' : standard === 'CHADEMO' ? 'DC charging' : 'Fast DC'; }

/** Site power can only be attributed to a connector when the site reports exactly that standard. */
export function compatiblePower(station: MapStation, standard: string): number | null {
  const standards = [...new Set(station.connector_types ?? [])];
  return standards.length === 1 && standards[0] === standard ? station.max_power_kw : null;
}
export function equipmentLabel(station: MapStation, standard: ConnectorStandard) {
  const power = compatiblePower(station, standard);
  return `${formatConnector(standard)} · ${power === null ? 'Power not reported' : `Up to ${power} kW`}`;
}
export function compatibleObservation(evidence: StationEvidence, standard: ConnectorStandard, now: number) {
  const evses = [...new Map(evidence.evses.map((evse) => [evse.id, evse])).values()]
    .filter((evse) => evse.connector_standards.includes(standard));
  const breakdown = Object.fromEntries(['AVAILABLE', 'CHARGING', 'RESERVED', 'BLOCKED', 'OUTOFORDER', 'INOPERATIVE', 'UNKNOWN', 'PLANNED', 'REMOVED']
    .map((status) => [status, evses.filter((evse) => evse.status === status).length]));
  const times = evses.map((evse) => evse.observed_at).sort((a, b) => Date.parse(a) - Date.parse(b));
  const observedAt = times[0] ?? null;
  const stale = !observedAt || evses.some((evse) => !Number.isFinite(Date.parse(evse.observed_at)) || now - Date.parse(evse.observed_at) > FRESHNESS_MS || now < Date.parse(evse.observed_at));
  const capacity = compatibleCapacity(evidence, standard, now);
  return { compatible: evses.length, breakdown, observedAt, stale, capacity,
    label: !evses.length ? 'No compatible charging points' : stale ? 'Current availability unverified' :
      capacity.available ? `${capacity.available} last seen available` : capacity.unknown ? 'Availability unknown' : 'None last seen available' };
}

/** Initial station is a geographic anchor for the existing congestion engine, never an invented driver origin. */
export function searchAnchor(stations: MapStation[], standard: ConnectorStandard, center: Coordinates, minPowerKw?: number) {
  if (!isCoordinates(center)) return null;
  return stations.filter((station) => station.connector_types?.includes(standard) &&
    (minPowerKw === undefined || (compatiblePower(station, standard) ?? -1) >= minPowerKw))
    .sort((a, b) => geographicDistanceMeters(center, { lat: a.latitude, lng: a.longitude }) -
      geographicDistanceMeters(center, { lat: b.latitude, lng: b.longitude }) || a.location_id.localeCompare(b.location_id))[0] ?? null;
}

export function navigationUrls(station: MapStation, platform: 'ios' | 'android' | 'web') {
  const destination = { lat: station.latitude, lng: station.longitude };
  if (!isCoordinates(destination)) throw new Error('Station coordinates unavailable. Choose another station.');
  const coords = `${destination.lat},${destination.lng}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${coords}&travelmode=driving`;
  return platform === 'ios' ? [`https://maps.apple.com/?daddr=${coords}&dirflg=d`, google] :
    platform === 'android' ? [`google.navigation:q=${coords}&mode=d`, google] : [google];
}

/** Bounded geographic search display; this does not change the congestion ranking policy. */
export function searchOptions(rows: StationEvidence[], standard: ConnectorStandard, origin: Coordinates) {
  return rows.filter(row => compatibleCapacity(row, standard, Date.now()).compatible > 0)
    .sort((a, b) => geographicDistanceMeters(origin, { lat: a.station.latitude, lng: a.station.longitude }) -
      geographicDistanceMeters(origin, { lat: b.station.latitude, lng: b.station.longitude }) || a.station.location_id.localeCompare(b.station.location_id)).slice(0, 3);
}

export function displayedRoute(outcome: RouteOutcome | undefined, station: MapStation, origin: Coordinates, now: number) {
  const route = outcome && 'route' in outcome ? outcome.route : null;
  return isDrivingRoute(route) && sameCoordinates(route.origin, origin) &&
    sameCoordinates(route.destination, { lat: station.latitude, lng: station.longitude }) &&
    now >= Date.parse(route.calculatedAt) && now - Date.parse(route.calculatedAt) <= ROUTE_MAX_AGE_MS ? route : null;
}
