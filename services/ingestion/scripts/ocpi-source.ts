import { parseEnvelope, locationKey } from './investigate-ocpi.ts';

export const SOURCE = 'via-lietuva-ocpi';
export const ENDPOINT = 'https://ev.vialietuva.lt/ocpi/2.3.0/locations';
export type Row = Record<string, unknown>;
export interface Snapshot { locations: Row[]; evses: Row[]; connectors: Row[] }
export interface PageEvidence { offset: number; limit: number; returned: number; total: string | null; link: string | null }
export interface Evidence { pages: PageEvidence[]; duplicates: number; advertisedTotal: number | null; verified: boolean; replaySha256?: string }
const statuses = new Set(['AVAILABLE', 'BLOCKED', 'CHARGING', 'INOPERATIVE', 'OUTOFORDER', 'PLANNED', 'REMOVED', 'RESERVED', 'UNKNOWN']);
function record(v: unknown): Row {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected an object');
  return v as Row;
}
function array(v: unknown): unknown[] {
  if (!Array.isArray(v)) throw new Error('Missing or invalid entity array');
  return v;
}
function text(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new Error('Invalid text field');
  return v;
}
function identity(v: unknown): string {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return String(v);
  if (typeof v === 'string' && v !== '' && v === v.trim()) return v;
  throw new Error('Invalid source identity');
}
function number(v: unknown, max: number, integer = false): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > max || (integer && !Number.isInteger(v))) throw new Error('Invalid positive numeric field');
  return v;
}
function coordinate(v: unknown, max: number): number {
  if (!((typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) || typeof v === 'number')) throw new Error('Invalid coordinate');
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > max) throw new Error('Coordinate out of range');
  return n;
}
function timestamp(v: unknown): Row {
  const raw = text(v);
  // Offset-free or unparseable dates stay as raw evidence, without guessing a zone.
  const explicit = raw !== null && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(raw) && Number.isFinite(Date.parse(raw));
  return { source_last_updated_text: raw, source_last_updated_at: explicit ? new Date(Date.parse(raw)).toISOString() : null };
}
export function key(...parts: unknown[]): string { return JSON.stringify(parts); }
function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v !== null && typeof v === 'object') return '{' + Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, value]) => JSON.stringify(k) + ':' + stable(value)).join(',') + '}';
  return JSON.stringify(v);
}
function add(map: Map<string, Row>, id: string, row: Row): boolean {
  const previous = map.get(id);
  if (previous && stable(previous) !== stable(row)) throw new Error('Conflicting duplicate canonical identity');
  if (!previous) map.set(id, row);
  return Boolean(previous);
}
export function parseLocations(value: unknown, observedAt: string): Snapshot {
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('Invalid observation time');
  const locations = new Map<string, Row>(), evses = new Map<string, Row>(), connectors = new Map<string, Row>();
  for (const raw of parseEnvelope(value).data) {
    locationKey(raw);
    const l = record(raw), country_code = identity(l.country_code), party_id = identity(l.party_id), ocpi_location_id = identity(l.id);
    if (!/^[A-Z]{2}$/.test(country_code)) throw new Error('Invalid country code');
    const scope = { source: SOURCE, country_code, party_id };
    const location_key = key(SOURCE, country_code, party_id, ocpi_location_id);
    const operator = l.operator == null ? {} : record(l.operator);
    const coordinates = l.coordinates == null ? null : record(l.coordinates);
    add(locations, location_key, { ...scope, ocpi_location_id, operator_name: text(operator.name), operator_website: text(operator.website), name: text(l.name), address: text(l.address), city: text(l.city), country: text(l.country), latitude: coordinates ? coordinate(coordinates.latitude, 90) : null, longitude: coordinates ? coordinate(coordinates.longitude, 180) : null, ...timestamp(l.last_updated), source_metadata: {}, first_observed_at: observedAt, last_observed_at: observedAt });
    for (const rawEvse of array(l.evses)) {
      const e = record(rawEvse), uid = identity(e.uid), source_status = text(e.status);
      const evse_key = key(SOURCE, country_code, party_id, uid);
      add(evses, evse_key, { ...scope, uid, location_key, public_evse_id: text(e.evse_id), current_status: source_status !== null && statuses.has(source_status) ? source_status : 'UNKNOWN', source_status, ...timestamp(e.last_updated), source_metadata: {}, first_observed_at: observedAt, last_observed_at: observedAt });
      for (const rawConnector of array(e.connectors)) {
        const c = record(rawConnector), connector_id = identity(c.id);
        add(connectors, key(evse_key, connector_id), { evse_key, connector_id, standard: text(c.standard), format: text(c.format), power_type: text(c.power_type), rated_power_w: number(c.max_electric_power, 2147483647, true), voltage: number(c.voltage, Number.MAX_VALUE), amperage: number(c.amperage, Number.MAX_VALUE), tariff_ids: c.tariff_ids == null ? null : array(c.tariff_ids).map(identity), ...timestamp(c.last_updated) });
      }
    }
  }
  return { locations: [...locations.values()], evses: [...evses.values()], connectors: [...connectors.values()] };
}
export function snapshotIdentities(s: Snapshot): string[] {
  return [...s.locations.map(l => 'L' + key(l.source, l.country_code, l.party_id, l.ocpi_location_id)), ...s.evses.map(e => 'E' + key(e.source, e.country_code, e.party_id, e.uid)), ...s.connectors.map(c => 'C' + key(c.evse_key, c.connector_id))].sort();
}
export async function fetchSnapshot(evidence: Evidence, request: typeof fetch = fetch, wait: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)), capture?: (envelope: unknown) => Promise<void>): Promise<Snapshot> {
  async function page(offset: number, limit: number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await request(`${ENDPOINT}?limit=${limit}&offset=${offset}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000), redirect: 'error' });
        if (!response.ok) {
          if (response.status !== 429 && response.status < 500) throw new Error('Nonretryable HTTP response');
          throw new Error('Retryable HTTP response');
        }
        const envelope = parseEnvelope(await response.json());
        const total = response.headers.get('x-total-count');
        evidence.pages.push({ offset, limit, returned: envelope.data.length, total, link: response.headers.get('link')?.slice(0, 512) ?? null });
        return { envelope, total, observedAt: new Date().toISOString() };
      } catch (error) {
        if (error instanceof Error && error.message === 'Nonretryable HTTP response') throw error;
        if (attempt === 2) throw new Error('Source request failed after 3 bounded attempts');
        await wait(250 * 2 ** attempt);
      }
    }
    throw new Error('Unreachable retry state');
  }
  const locations = new Map<string, Row>(), evses = new Map<string, Row>(), connectors = new Map<string, Row>();
  const rawLocations: unknown[] = [];
  for (let offset = 0; offset <= 100_000; offset += 1000) {
    const p = await page(offset, 1000);
    if (p.total === null || !/^\d+$/.test(p.total) || Number(p.total) >= 100_000) throw new Error('Unverifiable pagination boundary');
    const total = Number(p.total);
    if (evidence.advertisedTotal !== null && evidence.advertisedTotal !== total) throw new Error('Advertised boundary changed during traversal');
    evidence.advertisedTotal = total;
    const s = parseLocations(p.envelope, p.observedAt);
    rawLocations.push(...p.envelope.data);
    // Observation times differ across pages; duplicate content must agree excluding these times.
    for (const [rows, map, id] of [[s.locations, locations, (r: Row) => key(r.source, r.country_code, r.party_id, r.ocpi_location_id)], [s.evses, evses, (r: Row) => key(r.source, r.country_code, r.party_id, r.uid)], [s.connectors, connectors, (r: Row) => key(r.evse_key, r.connector_id)]] as const) {
      for (const row of rows) {
        const previous = map.get(id(row));
        if (previous && 'first_observed_at' in row) { row.first_observed_at = previous.first_observed_at; row.last_observed_at = previous.last_observed_at; }
        if (add(map, id(row), row)) evidence.duplicates++;
      }
    }
    if (offset >= total) {
      if (p.envelope.data.length !== 0) throw new Error('Nonempty page beyond advertised boundary');
      const probe = await page(0, 100_000);
      if (probe.total !== p.total) throw new Error('Boundary changed during verification');
      const result = { locations: [...locations.values()], evses: [...evses.values()], connectors: [...connectors.values()] };
      if (stable(snapshotIdentities(result)) !== stable(snapshotIdentities(parseLocations(probe.envelope, probe.observedAt)))) throw new Error('Independent large-window identities disagree: incomplete fetch');
      evidence.verified = true;
      await capture?.({ ...p.envelope, data: rawLocations });
      return result;
    }
  }
  throw new Error('Pagination safety cap exceeded');
}
