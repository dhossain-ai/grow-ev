import { fetchMapStations } from '../map/api';
import { fetchStationCapacity } from '../map/capacityApi';
import { geographicDistanceMeters } from '../../../../../packages/routing';
import type { StationEvidence } from '../map/congestion';
import type { MapStation } from '../map/types';
import { inNetworkArea, NETWORK_BOUNDS } from './overview';

export interface NetworkEvidence {
  records: StationEvidence[];
  mappedLocations: number;
  anchor: MapStation | null;
  fetchedAt: string;
}
/** One bounded read sequence on entry/manual refresh. No polling or route requests. */
export async function fetchNetworkEvidence(signal?: AbortSignal): Promise<NetworkEvidence> {
  const mapped = (await fetchMapStations(NETWORK_BOUNDS, undefined, signal)).filter(inNetworkArea);
  const distance = (s: MapStation) => geographicDistanceMeters({ lat: s.latitude, lng: s.longitude }, { lat: 54.70, lng: 25.28 });
  const anchor = mapped.filter((s) => s.total_evse_count > 0).sort((a, b) =>
    distance(a) - distance(b) || a.location_id.localeCompare(b.location_id))[0] ?? null;
  const records = anchor ? (await fetchStationCapacity(anchor.location_id, signal)).filter((r) => inNetworkArea(r.station)) : [];
  return { records, mappedLocations: mapped.length, anchor, fetchedAt: new Date().toISOString() };
}
