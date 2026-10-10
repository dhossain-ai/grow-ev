/** Shared types for the map stations API. */

/** EVSE availability status categories used in the map UI. */
export type AvailabilityCategory = 'available' | 'occupied' | 'unavailable' | 'unknown';

/** Station data returned by the get_map_stations RPC. */
export interface MapStation {
  location_id: string;
  name: string | null;
  operator_name: string | null;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  total_evse_count: number;
  available_evse_count: number;
  charging_evse_count: number;
  unavailable_evse_count: number;
  unknown_evse_count: number;
  connector_types: string[] | null;
  max_power_kw: number | null;
  last_observed_at: string | null;
}

/** Validate public data before it reaches map rendering. */
export function isMapStation(value: unknown): value is MapStation {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  const counts = ['total_evse_count', 'available_evse_count', 'charging_evse_count',
    'unavailable_evse_count', 'unknown_evse_count'] as const;
  return typeof s.location_id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.location_id) &&
    ['name', 'operator_name', 'address', 'city'].every((k) => s[k] === null || typeof s[k] === 'string') &&
    typeof s.latitude === 'number' && Number.isFinite(s.latitude) && Math.abs(s.latitude) <= 90 &&
    typeof s.longitude === 'number' && Number.isFinite(s.longitude) && Math.abs(s.longitude) <= 180 &&
    counts.every((k) => typeof s[k] === 'number' && Number.isSafeInteger(s[k]) && s[k] >= 0) &&
    s.total_evse_count === Number(s.available_evse_count) + Number(s.charging_evse_count) +
      Number(s.unavailable_evse_count) + Number(s.unknown_evse_count) &&
    (s.connector_types === null || (Array.isArray(s.connector_types) &&
      s.connector_types.every((c) => typeof c === 'string'))) &&
    (s.max_power_kw === null || (typeof s.max_power_kw === 'number' &&
      Number.isFinite(s.max_power_kw) && s.max_power_kw >= 0)) &&
    (s.last_observed_at === null || (typeof s.last_observed_at === 'string' &&
      Number.isFinite(Date.parse(s.last_observed_at))));
}

/** Bounding box for spatial queries: [west, south, east, north]. */
export type BoundingBox = [number, number, number, number];

/** Filter parameters for map station requests. */
export interface StationFilters {
  connectorStandards?: string[];
  minPowerKw?: number;
}

/** GeoJSON Feature for a station. */
export interface StationFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: MapStation & {
    /** Dominant availability category for coloring. */
    availability: AvailabilityCategory;
  };
}

/** GeoJSON FeatureCollection of stations. */
export interface StationFeatureCollection {
  type: 'FeatureCollection';
  features: StationFeature[];
}

/**
 * Determine the dominant availability category for a station.
 * Priority: available > occupied > unavailable > unknown.
 */
export function getAvailability(station: MapStation): AvailabilityCategory {
  if (station.available_evse_count > 0) return 'available';
  if (station.charging_evse_count > 0) return 'occupied';
  if (station.unavailable_evse_count > 0) return 'unavailable';
  return 'unknown';
}

/** Convert API response to GeoJSON FeatureCollection. */
export function toGeoJSON(stations: MapStation[]): StationFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.longitude, s.latitude] as [number, number],
      },
      properties: {
        ...s,
        availability: isStale(s) ? 'unknown' : getAvailability(s),
      },
    })),
  };
}

/** Human-readable connector standard names. */
const CONNECTOR_LABELS: Record<string, string> = {
  CHADEMO: 'CHAdeMO',
  IEC_62196_T2: 'Type 2',
  IEC_62196_T2_COMBO: 'CCS2',
  IEC_62196_T1: 'Type 1',
  IEC_62196_T1_COMBO: 'CCS1',
  DOMESTIC_A: 'Domestic A',
  DOMESTIC_B: 'Domestic B',
  DOMESTIC_C: 'Domestic C',
  DOMESTIC_D: 'Domestic D',
  DOMESTIC_E: 'Domestic E',
  DOMESTIC_F: 'Schuko',
  DOMESTIC_G: 'Domestic G',
  DOMESTIC_H: 'Domestic H',
  DOMESTIC_I: 'Domestic I',
  DOMESTIC_J: 'Domestic J',
  DOMESTIC_K: 'Domestic K',
  DOMESTIC_L: 'Domestic L',
  TESLA_R: 'Tesla',
  TESLA_S: 'Tesla S',
  GBT_AC: 'GB/T AC',
  GBT_DC: 'GB/T DC',
  NEMA_5_20: 'NEMA 5-20',
  NEMA_6_30: 'NEMA 6-30',
  NEMA_6_50: 'NEMA 6-50',
  NEMA_14_30: 'NEMA 14-30',
  NEMA_14_50: 'NEMA 14-50',
};

/** Format a connector standard for display. */
export function formatConnector(standard: string): string {
  return CONNECTOR_LABELS[standard] ?? standard;
}

/** Format power in kW for display. */
export function formatPower(kw: number | null): string {
  if (kw == null) return 'Unknown';
  return `${kw} kW`;
}

/** Check if station data is stale (older than given minutes). */
export function isStale(station: MapStation, minutesThreshold: number = 60): boolean {
  if (!station.last_observed_at) return true;
  const age = Date.now() - new Date(station.last_observed_at).getTime();
  return !Number.isFinite(age) || age < 0 || age > minutesThreshold * 60 * 1000;
}

/** Format relative time since last observation. */
export function formatAge(isoString: string | null): string {
  if (!isoString) return 'Never observed';
  const ms = Date.now() - new Date(isoString).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'Observation time unverified';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
