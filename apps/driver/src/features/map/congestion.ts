import { isMapStation, type MapStation } from './types';
import { geographicDistanceMeters } from '../../../../../packages/routing';

export const CONNECTOR_OPTIONS = [
  { value: 'IEC_62196_T2_COMBO', label: 'CCS2' },
  { value: 'IEC_62196_T2', label: 'Type 2' },
  { value: 'CHADEMO', label: 'CHAdeMO' },
] as const;
export type ConnectorStandard = typeof CONNECTOR_OPTIONS[number]['value'];
export const FRESHNESS_MS = 60 * 60 * 1000;
export const SEARCH_RADIUS_KM = 10;
const STATUSES = ['AVAILABLE', 'CHARGING', 'BLOCKED', 'RESERVED', 'INOPERATIVE',
  'OUTOFORDER', 'PLANNED', 'REMOVED', 'UNKNOWN'] as const;
export interface EvseEvidence {
  id: string;
  status: typeof STATUSES[number];
  observed_at: string;
  connector_standards: string[];
}
export interface StationEvidence { station: MapStation; evses: EvseEvidence[] }
export type CongestionState = 'available' | 'congested' | 'no-compatible' | 'stale' | 'unknown' | 'unavailable';
export interface Capacity {
  state: CongestionState;
  available: number;
  compatible: number;
  occupied: number;
  unknown: number;
  stale: number;
  observedAt: string | null;
}
export interface Alternative { evidence: StationEvidence; capacity: Capacity; distanceKm: number }

export function isStationEvidence(value: unknown): value is StationEvidence {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (!isMapStation(row.station) || !Array.isArray(row.evses) ||
      row.evses.length !== row.station.total_evse_count) return false;
  const ids = new Set<string>();
  return row.evses.every((value: unknown) => {
    if (!value || typeof value !== 'object') return false;
    const e = value as Record<string, unknown>;
    if (typeof e.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id) || ids.has(e.id) ||
        !STATUSES.includes(e.status as EvseEvidence['status']) ||
        typeof e.observed_at !== 'string' || !Number.isFinite(Date.parse(e.observed_at)) ||
        !Array.isArray(e.connector_standards) || !e.connector_standards.every((s) => typeof s === 'string')) return false;
    ids.add(e.id);
    return true;
  });
}

export function compatibleCapacity(evidence: StationEvidence, standard: ConnectorStandard, now: number): Capacity {
  // One record per canonical EVSE, regardless of how many connector options it has.
  const compatible = [...new Map(evidence.evses.map((e) => [e.id, e])).values()]
    .filter((e) => e.connector_standards.includes(standard));
  const fresh = compatible.filter((e) => {
    const age = now - Date.parse(e.observed_at);
    return Number.isFinite(age) && age >= 0 && age <= FRESHNESS_MS;
  });
  const available = fresh.filter((e) => e.status === 'AVAILABLE').length;
  const occupied = fresh.filter((e) => ['CHARGING', 'BLOCKED', 'RESERVED'].includes(e.status)).length;
  const unknown = fresh.filter((e) => e.status === 'UNKNOWN').length;
  const stale = compatible.length - fresh.length;
  // Stale compatible EVSEs could be available: do not assert current saturation.
  const state: CongestionState = !compatible.length ? 'no-compatible' : available ? 'available' :
    stale ? 'stale' : occupied ? 'congested' : unknown ? 'unknown' : 'unavailable';
  return { state, available, occupied, unknown, stale, compatible: compatible.length,
    observedAt: fresh.filter((e) => e.status === 'AVAILABLE').map((e) => e.observed_at)
      .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null };
}

/** Great-circle geographic distance, never road distance or ETA. */
export function straightLineKm(a: MapStation, b: MapStation): number {
  return geographicDistanceMeters({ lat: a.latitude, lng: a.longitude },
    { lat: b.latitude, lng: b.longitude }) / 1000;
}

export function findAlternatives(target: StationEvidence, stations: StationEvidence[], standard: ConnectorStandard, now: number): Alternative[] {
  if (compatibleCapacity(target, standard, now).state !== 'congested') return [];
  return stations.filter((s) => s.station.location_id !== target.station.location_id)
    .map((evidence) => ({ evidence, capacity: compatibleCapacity(evidence, standard, now),
      distanceKm: straightLineKm(target.station, evidence.station) }))
    .filter((a) => a.capacity.available > 0 && a.distanceKm <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm || b.capacity.available - a.capacity.available ||
      a.evidence.station.location_id.localeCompare(b.evidence.station.location_id))
    .slice(0, 3);
}

export const CONGESTION_EXPLANATIONS: Record<CongestionState, string> = {
  available: 'Compatible charging capacity is available in the latest fresh observations.',
  congested: 'No compatible EVSE is available. Compatible EVSEs are charging, blocked or reserved.',
  'no-compatible': 'No EVSE reports this connector at this station.',
  stale: 'Compatible observations are stale or invalid. Current congestion cannot be confirmed.',
  unknown: 'Compatible status is UNKNOWN. Availability cannot be confirmed.',
  unavailable: 'Compatible EVSEs are out of service, planned or removed. This is not congestion.',
};
