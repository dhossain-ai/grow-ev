import { isStationEvidence, type StationEvidence } from './congestion';
import { StationsApiError } from './api';

export async function fetchStationCapacity(locationId: string, signal?: AbortSignal): Promise<StationEvidence[]> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new StationsApiError('Public Supabase configuration is missing');
  const rows: StationEvidence[] = [];
  let total = 0;
  do {
    const response = await fetch(`${url}/rest/v1/rpc/get_station_capacity?limit=1000&offset=${rows.length}`, {
      method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', Prefer: 'count=exact' },
      body: JSON.stringify({ target_location_id: locationId }), signal,
    });
    if (!response.ok) throw new StationsApiError('Compatible capacity could not be checked. Please retry.', response.status);
    const data: unknown = await response.json();
    const count = response.headers.get('content-range')?.split('/')[1];
    if (!Array.isArray(data) || !data.every(isStationEvidence) || !count || !/^\d+$/.test(count)) {
      throw new StationsApiError('Invalid capacity evidence');
    }
    total = Number(count);
    if (total > 2000 || rows.length + data.length > total || (!data.length && rows.length < total)) {
      throw new StationsApiError('Incomplete capacity evidence');
    }
    rows.push(...data);
  } while (rows.length < total);
  if (!rows.some((r) => r.station.location_id === locationId) ||
      new Set(rows.map((r) => r.station.location_id)).size !== rows.length ||
      new Set(rows.flatMap((r) => r.evses.map((e) => e.id))).size !== rows.reduce((n, r) => n + r.evses.length, 0)) {
    throw new StationsApiError('Missing or duplicate capacity evidence');
  }
  return rows;
}
