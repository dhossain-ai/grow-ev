import { isCoordinates, isDrivingRoute, sameCoordinates, ROUTE_MAX_AGE_MS,
  type Coordinates, type DrivingRoute, type RouteOutcome } from '../../../../../packages/routing';
import { compatibleCapacity, findAlternatives, CONNECTOR_OPTIONS, FRESHNESS_MS,
  type Alternative, type Capacity, type ConnectorStandard, type StationEvidence } from './congestion';

export interface Recommendation extends Alternative {
  route: DrivingRoute | null;
  /** Signed difference against the primary's estimated drive, never against waiting. */
  drivingDifferenceSeconds: number | null;
  reasons: string[];
}
export interface RecommendationResult {
  selectedCapacity: Capacity;
  originKind: 'selected-charger' | 'user-origin';
  origin: Coordinates | null;
  rankingBasis: 'driving-time' | 'geographic-proximity';
  recommendations: Recommendation[];
}

/** No I/O. Reuses canonical EVSE eligibility/freshness and the nearest-three shortlist.
 * Only complete, comparable route coverage changes ranking; missing time is unknown.
 */
export function recommendAlternatives(selected: StationEvidence, stations: StationEvidence[],
  standard: ConnectorStandard, now: number, outcomes: Readonly<Record<string, RouteOutcome>> = {},
  userOrigin?: Coordinates): RecommendationResult {
  const selectedCapacity = compatibleCapacity(selected, standard, now);
  const originKind = userOrigin === undefined ? 'selected-charger' : 'user-origin';
  const suppliedOrigin = userOrigin === undefined ? { lat: selected.station.latitude, lng: selected.station.longitude } : userOrigin;
  const origin = isCoordinates(suppliedOrigin) ? suppliedOrigin : null;
  const recommendations: Recommendation[] = findAlternatives(selected, stations, standard, now).map((a) => {
    const outcome = outcomes[a.evidence.station.location_id];
    const candidate = outcome && 'route' in outcome ? outcome.route : null;
    const destination = { lat: a.evidence.station.latitude, lng: a.evidence.station.longitude };
    const age = candidate ? now - Date.parse(candidate.calculatedAt) : NaN;
    const route = origin && isDrivingRoute(candidate) && sameCoordinates(candidate.origin, origin) &&
      sameCoordinates(candidate.destination, destination) && age >= 0 && age <= ROUTE_MAX_AGE_MS ? candidate : null;
    return { ...a, route, drivingDifferenceSeconds: null, reasons: [] };
  });
  const completeRoutes = recommendations.length > 0 && recommendations.every((a) => a.route &&
    a.route.trafficAware === recommendations[0].route?.trafficAware);
  const rankingBasis = completeRoutes ? 'driving-time' : 'geographic-proximity';
  if (completeRoutes) recommendations.sort((a, b) =>
    a.route!.drivingDurationSeconds - b.route!.drivingDurationSeconds || a.distanceKm - b.distanceKm ||
    b.capacity.available - a.capacity.available || a.evidence.station.location_id.localeCompare(b.evidence.station.location_id));

  const primary = recommendations[0];
  const connector = CONNECTOR_OPTIONS.find((option) => option.value === standard)!.label;
  const travelLabel = originKind === 'selected-charger' ? 'Charger-to-charger travel' : 'Travel from your provided origin';
  for (const a of recommendations) {
    if (a.route && primary.route && a.route.trafficAware === primary.route.trafficAware) {
      a.drivingDifferenceSeconds = a.route.drivingDurationSeconds - primary.route.drivingDurationSeconds;
    }
    const observationAgeMinutes = Math.floor((now - Date.parse(a.capacity.observedAt!)) / 60000);
    a.reasons = [
      `${a.capacity.available} ${connector}-compatible EVSE${a.capacity.available === 1 ? '' : 's'} observed AVAILABLE.`,
      `Selected charger: no compatible AVAILABLE EVSE; ${selectedCapacity.occupied} charging, blocked or reserved.`,
      `${a.distanceKm.toFixed(1)} km straight-line from the selected charger.`,
      `Oldest available observation: ${observationAgeMinutes} min ago; within the ${FRESHNESS_MS / 60000}-minute freshness limit.`,
    ];
    if (a.capacity.stale || a.capacity.unknown) a.reasons.push(
      `${a.capacity.stale} stale/invalid and ${a.capacity.unknown} unknown compatible EVSEs excluded from the available count.`);
    if (a.route) a.reasons.push(`${travelLabel}: ${(a.route.drivingDurationSeconds / 60).toFixed(1)} min estimated drive; ${(a.route.roadDistanceMeters / 1000).toFixed(1)} km by road.`);
    else a.reasons.push('Driving time unavailable. Geographic proximity is the fallback; road reachability is unverified.');
    if (a !== primary && a.drivingDifferenceSeconds !== null) {
      const difference = a.drivingDifferenceSeconds;
      const duration = Math.abs(difference) < 60 ? `${Math.abs(difference).toFixed(0)} sec` : `${(Math.abs(difference) / 60).toFixed(1)} min`;
      a.reasons.push(difference === 0 ? 'Same estimated driving time as the primary recommendation.' :
        `${duration} ${difference > 0 ? 'longer' : 'shorter'} estimated drive than the primary recommendation from the same origin.`);
    }
  }
  return { selectedCapacity, originKind, origin, rankingBasis, recommendations };
}
