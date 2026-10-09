/**
 * Supabase API client for map station data.
 *
 * Uses a public publishable key (or legacy anon key) for the RPC.
 * No service-role key or database password is used.
 */
import { isMapStation, type BoundingBox, type MapStation, type StationFilters } from './types';

/** Supabase project configuration. Only public keys are used. */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLIC_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Error thrown when the stations API fails. */
export class StationsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'StationsApiError';
  }
}

/**
 * Fetch charging stations within a bounding box from the Supabase RPC.
 *
 * @throws {StationsApiError} on network or API errors.
 */
export async function fetchMapStations(
  bounds: BoundingBox,
  filters?: StationFilters,
  signal?: AbortSignal,
): Promise<MapStation[]> {
  if (!SUPABASE_URL || !SUPABASE_PUBLIC_KEY) {
    throw new StationsApiError('Public Supabase configuration is missing');
  }
  const [minLng, minLat, maxLng, maxLat] = bounds;

  const body: Record<string, unknown> = {
    min_lng: minLng,
    max_lng: maxLng,
    min_lat: minLat,
    max_lat: maxLat,
  };

  if (filters?.connectorStandards && filters.connectorStandards.length > 0) {
    body.connector_standards = filters.connectorStandards;
  }
  if (filters?.minPowerKw != null && filters.minPowerKw > 0) {
    body.min_power_kw = filters.minPowerKw;
  }

  const stations: MapStation[] = [];
  // PostgREST's row cap can be lower than the RPC ceiling. Request exact totals
  // and page explicitly so a successful response never silently hides stations.
  let total = 0;
  do {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_map_stations?limit=1000&offset=${stations.length}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLIC_KEY,
          Prefer: 'count=exact',
        },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (!response.ok) {
      throw new StationsApiError(`Stations API error: ${response.status}`, response.status);
    }
    const data: unknown = await response.json();
    const rangeTotal = response.headers.get('content-range')?.split('/')[1];
    if (!Array.isArray(data) || !data.every(isMapStation) ||
        !rangeTotal || !/^\d+$/.test(rangeTotal)) {
      throw new StationsApiError('Unexpected API response format');
    }
    total = Number(rangeTotal);
    if (total > 2000 || stations.length + data.length > total ||
        (data.length === 0 && stations.length < total)) {
      throw new StationsApiError('Incomplete or oversized stations response');
    }
    stations.push(...data);
  } while (stations.length < total);
  if (new Set(stations.map((s) => s.location_id)).size !== stations.length) {
    throw new StationsApiError('Duplicate stations response');
  }
  return stations;
}
