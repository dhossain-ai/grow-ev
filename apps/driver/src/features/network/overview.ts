import { compatibleCapacity, findAlternatives, FRESHNESS_MS, type ConnectorStandard, type StationEvidence } from '../map/congestion';
import type { BoundingBox, MapStation } from '../map/types';

// An explicit central/northern Vilnius window, not administrative city boundaries.
export const NETWORK_BOUNDS: BoundingBox = [25.20, 54.64, 25.36, 54.76];
export function inNetworkArea(station: MapStation): boolean {
  const [west, south, east, north] = NETWORK_BOUNDS;
  return station.longitude >= west && station.longitude <= east && station.latitude >= south && station.latitude <= north;
}
export function isFreshObservation(iso: string, now: number): boolean {
  const age = now - Date.parse(iso);
  return Number.isFinite(age) && age >= 0 && age <= FRESHNESS_MS;
}
export interface NetworkPair {
  source: StationEvidence;
  alternative: StationEvidence;
  available: number;
  occupied: number;
  distanceKm: number;
  crossOperator: boolean;
  historical: boolean;
  evaluatedAt: number;
}
export function networkOverview(records: StationEvidence[], standard: ConnectorStandard, now: number) {
  const stations = [...new Map(records.filter((r) => inNetworkArea(r.station))
    .map((r) => [r.station.location_id, r])).values()];
  const selected = stations.filter((r) => r.evses.some((e) => e.connector_standards.includes(standard)));
  const evses = [...new Map(selected.flatMap((r) => r.evses)
    .filter((e) => e.connector_standards.includes(standard)).map((e) => [e.id, e])).values()];
  const validTimes = evses.map((e) => Date.parse(e.observed_at)).filter((t) => Number.isFinite(t) && t <= now);
  const newest = validTimes.length ? Math.max(...validTimes) : null;
  const oldest = validTimes.length ? Math.min(...validTimes) : null;
  const fresh = evses.filter((e) => isFreshObservation(e.observed_at, now));
  const count = (status: string) => evses.filter((e) => e.status === status).length;
  const pairAt = (time: number, historical: boolean): NetworkPair[] => selected.flatMap((source) => {
    const occupied = compatibleCapacity(source, standard, time).occupied;
    return findAlternatives(source, selected, standard, time).map((a) => {
      const operatorA = source.station.operator_name?.trim().toLocaleLowerCase();
      const operatorB = a.evidence.station.operator_name?.trim().toLocaleLowerCase();
      return { source, alternative: a.evidence, available: a.capacity.available, occupied,
        distanceKm: a.distanceKm, crossOperator: Boolean(operatorA && operatorB && operatorA !== operatorB),
        historical, evaluatedAt: time };
    });
  }).sort((a, b) => Number(b.crossOperator) - Number(a.crossOperator) || a.distanceKm - b.distanceKm ||
    a.source.station.location_id.localeCompare(b.source.station.location_id) ||
    a.alternative.station.location_id.localeCompare(b.alternative.station.location_id));
  const pairs = pairAt(now, false);
  const historicalPairs = newest === null ? [] : pairAt(newest, true).filter((p) =>
    !pairs.some((current) => current.source.station.location_id === p.source.station.location_id &&
      current.alternative.station.location_id === p.alternative.station.location_id));
  return {
    locations: selected.length, evses: evses.length, available: count('AVAILABLE'), charging: count('CHARGING'),
    unknown: count('UNKNOWN'), otherUnavailable: evses.length - count('AVAILABLE') - count('CHARGING') - count('UNKNOWN'),
    fresh: fresh.length, stale: evses.length - fresh.length,
    freshAvailable: fresh.filter((e) => e.status === 'AVAILABLE').length,
    oldest, newest, pairs, historicalPairs,
    congestedLocations: selected.filter((s) => compatibleCapacity(s, standard, now).state === 'congested').length,
    operators: new Set(selected.map((r) => r.station.operator_name?.trim().toLocaleLowerCase()).filter(Boolean)).size,
  };
}
