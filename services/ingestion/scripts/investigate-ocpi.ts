import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_ENDPOINT = 'https://ev.vialietuva.lt/ocpi/2.3.0/locations';

type JsonRecord = Record<string, unknown>;

interface Connector {
  id?: unknown;
  standard?: unknown;
  power_type?: unknown;
  voltage?: unknown;
  amperage?: unknown;
  max_electric_power?: unknown;
  tariff_ids?: unknown;
  last_updated?: unknown;
}

interface Evse {
  uid?: unknown;
  evse_id?: unknown;
  status?: unknown;
  connectors?: unknown;
  last_updated?: unknown;
}

interface Location {
  country_code?: unknown;
  party_id?: unknown;
  id?: unknown;
  name?: unknown;
  city?: unknown;
  coordinates?: unknown;
  operator?: unknown;
  evses?: unknown;
  last_updated?: unknown;
}

interface OcpiEnvelope {
  timestamp: string;
  status_code: number;
  status_message?: string;
  data: Location[];
}

interface MissingCounts {
  locationName: number;
  operatorName: number;
  coordinates: number;
  locationTimestamp: number;
  evseId: number;
  evseTimestamp: number;
  connectors: number;
  connectorPower: number;
  tariffReferences: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function parseEnvelope(value: unknown): OcpiEnvelope {
  if (!isRecord(value)) {
    throw new Error('The response root is not a JSON object.');
  }

  if (typeof value.timestamp !== 'string') {
    throw new Error('The response is missing its timestamp.');
  }

  if (typeof value.status_code !== 'number') {
    throw new Error('The response is missing its numeric status_code.');
  }

  if (value.status_code !== 1000) {
    throw new Error(
      `The OCPI endpoint returned status_code ${value.status_code}: ${String(value.status_message ?? 'no message')}`,
    );
  }

  if (!Array.isArray(value.data)) {
    throw new Error('The response data field is not an array.');
  }

  const data = value.data.filter(isRecord);
  if (data.length !== value.data.length) {
    throw new Error('The response data array contains non-object locations.');
  }

  return {
    data,
    status_code: value.status_code,
    status_message: asString(value.status_message),
    timestamp: value.timestamp,
  };
}

function countValues(values: string[]): Record<string, number> {
  return [...new Set(values)]
    .sort()
    .reduce<Record<string, number>>((counts, value) => {
      counts[value] = values.filter((candidate) => candidate === value).length;
      return counts;
    }, {});
}

function getOperatorName(location: Location): string | undefined {
  return isRecord(location.operator)
    ? asString(location.operator.name)
    : undefined;
}

function getCoordinates(location: Location): JsonRecord | undefined {
  return isRecord(location.coordinates) ? location.coordinates : undefined;
}

function getEvses(location: Location): Evse[] {
  return asRecordArray(location.evses);
}

function getConnectors(evse: Evse): Connector[] {
  return asRecordArray(evse.connectors);
}

function isVilnius(location: Location): boolean {
  return asString(location.city)?.trim().toLocaleLowerCase('lt-LT') === 'vilnius';
}

export function locationKey(location: Location): string {
  const parts = [location.country_code, location.party_id, location.id];
  if (parts.some((part) =>
    !(typeof part === 'string' && part.trim() !== '') &&
    !(typeof part === 'number' && Number.isSafeInteger(part)))) {
    throw new Error('Location has missing or invalid composite source identity.');
  }
  return JSON.stringify(parts.map(String));
}

function operatorCoverage(locations: Location[]) {
  const groups = new Map<string, { names: Set<string>; locations: number }>();
  for (const location of locations) {
    locationKey(location);
    const key = `${String(location.country_code)}|${String(location.party_id)}`;
    const group = groups.get(key) ?? { names: new Set<string>(), locations: 0 };
    const name = getOperatorName(location);
    if (name) group.names.add(name.trim());
    group.locations += 1;
    groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([id, group]) => ({
    id, names: [...group.names].sort(), locations: group.locations,
  }));
}

function getTimestampRange(values: unknown[]): { earliest?: string; latest?: string } {
  const timestamps = values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => ({ value, milliseconds: Date.parse(value) }))
    .filter(({ milliseconds }) => Number.isFinite(milliseconds))
    .sort((left, right) => left.milliseconds - right.milliseconds);

  return {
    earliest: timestamps.at(0)?.value,
    latest: timestamps.at(-1)?.value,
  };
}

function summarize(envelope: OcpiEnvelope, source: string) {
  const vilniusLocations = envelope.data.filter(isVilnius);
  const vilniusEvses = vilniusLocations.flatMap(getEvses);
  const vilniusConnectors = vilniusEvses.flatMap(getConnectors);
  const statuses = countValues(
    vilniusEvses.map((evse) => asString(evse.status) ?? 'MISSING'),
  );
  const knownStatuses = new Set([
    'AVAILABLE',
    'CHARGING',
    'INOPERATIVE',
    'OUTOFORDER',
  ]);
  const unknownOrOther = Object.entries(statuses)
    .filter(([status]) => !knownStatuses.has(status))
    .reduce((total, [, count]) => total + count, 0);
  const missing: MissingCounts = {
    locationName: vilniusLocations.filter((location) => !asString(location.name)).length,
    operatorName: vilniusLocations.filter((location) => !getOperatorName(location)).length,
    coordinates: vilniusLocations.filter((location) => {
      const coordinates = getCoordinates(location);
      return !asString(coordinates?.latitude) || !asString(coordinates?.longitude);
    }).length,
    locationTimestamp: vilniusLocations.filter(
      (location) => !asString(location.last_updated),
    ).length,
    evseId: vilniusEvses.filter((evse) => !asString(evse.evse_id)).length,
    evseTimestamp: vilniusEvses.filter((evse) => !asString(evse.last_updated)).length,
    connectors: vilniusEvses.filter((evse) => getConnectors(evse).length === 0).length,
    connectorPower: vilniusConnectors.filter(
      (connector) => typeof connector.max_electric_power !== 'number',
    ).length,
    tariffReferences: vilniusConnectors.filter(
      (connector) => !Array.isArray(connector.tariff_ids) || connector.tariff_ids.length === 0,
    ).length,
  };
  const operatorNames = vilniusLocations
    .map(getOperatorName)
    .filter((name): name is string => name !== undefined);

  return {
    source,
    responseTimestamp: envelope.timestamp,
    totalLocations: envelope.data.length,
    national: {
      uniqueLocations: new Set(envelope.data.map(locationKey)).size,
      evses: envelope.data.flatMap(getEvses).length,
      connectors: envelope.data.flatMap(getEvses).flatMap(getConnectors).length,
      distinctOperators: operatorCoverage(envelope.data).length,
      operators: operatorCoverage(envelope.data),
    },
    vilnius: {
      identificationRule: 'city trimmed and case-folded equals Vilnius',
      locations: vilniusLocations.length,
      evses: vilniusEvses.length,
      connectors: vilniusConnectors.length,
      availableEvses: statuses.AVAILABLE ?? 0,
      chargingOccupiedEvses: statuses.CHARGING ?? 0,
      inoperativeEvses: statuses.INOPERATIVE ?? 0,
      outOfOrderEvses: statuses.OUTOFORDER ?? 0,
      unknownOrOtherEvses: unknownOrOther,
      statuses,
      distinctOperators: operatorCoverage(vilniusLocations).length,
      operatorIdentifiers: operatorCoverage(vilniusLocations),
      operators: [...new Set(operatorNames)].sort(),
      connectorStandards: countValues(
        vilniusConnectors.map(
          (connector) => asString(connector.standard) ?? 'MISSING',
        ),
      ),
      powerTypes: countValues(
        vilniusConnectors.map(
          (connector) => asString(connector.power_type) ?? 'MISSING',
        ),
      ),
      connectorsPerEvse: countValues(
        vilniusEvses.map((evse) => String(getConnectors(evse).length)),
      ),
      timestamps: {
        locations: getTimestampRange(
          vilniusLocations.map((location) => location.last_updated),
        ),
        evses: getTimestampRange(vilniusEvses.map((evse) => evse.last_updated)),
        connectors: getTimestampRange(
          vilniusConnectors.map((connector) => connector.last_updated),
        ),
      },
      missing,
    },
  };
}

async function fetchPage(endpoint: string) {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Network request failed: ${String(error)}`, { cause: error });
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch (error) {
    throw new Error('The endpoint did not return valid JSON.', { cause: error });
  }
  return {
    envelope: parseEnvelope(value),
    headers: {
      link: response.headers.get('link'),
      totalCount: response.headers.get('x-total-count'),
      limit: response.headers.get('x-limit'),
    },
  };
}

async function fetchAllLocations() {
  // The published Link URLs are malformed. Advance explicit source windows,
  // not returned object counts: short pages occur before the final window.
  const limit = 1000;
  const pages = [];
  const locations: Location[] = [];
  const identities = new Set<string>();
  let totalCount: number | undefined;
  for (let offset = 0; offset < 100_000; offset += limit) {
    const page = await fetchPage(`${DEFAULT_ENDPOINT}?limit=${limit}&offset=${offset}`);
    const rawTotal = page.headers.totalCount;
    if (rawTotal === null || !/^\d+$/.test(rawTotal)) {
      throw new Error('Missing or invalid X-Total-Count; cannot verify full coverage.');
    }
    const total = Number(rawTotal);
    if (!Number.isSafeInteger(total) || total > 100_000) {
      throw new Error('Source count exceeds the investigation safety bound.');
    }
    if (totalCount !== undefined && totalCount !== total) {
      throw new Error('X-Total-Count changed during pagination; rerun investigation.');
    }
    totalCount = total;
    pages.push({ offset, returnedLocations: page.envelope.data.length, ...page.headers });
    for (const location of page.envelope.data) {
      const key = locationKey(location);
      if (identities.has(key)) throw new Error(`Duplicate location across pages: ${key}`);
      identities.add(key);
      locations.push(location);
    }
    if (offset + limit >= total) {
      return {
        envelope: { ...page.envelope, data: locations },
        pagination: { requestedLimit: limit, advertisedTotalCount: total, pages },
      };
    }
  }
  throw new Error('Pagination exceeded the investigation safety bound.');
}

async function verifyCoverage(locations: Location[]) {
  const probes = [];
  for (const query of ['', '?limit=2&offset=0', '?limit=2&offset=2', '?limit=10000&offset=0']) {
    const page = await fetchPage(DEFAULT_ENDPOINT + query);
    probes.push({ query, returnedLocations: page.envelope.data.length, ...page.headers });
    if (query.includes('10000')) {
      const expected = new Set(locations.map(locationKey));
      const actual = new Set(page.envelope.data.map(locationKey));
      if (actual.size !== page.envelope.data.length || actual.size !== expected.size ||
          [...actual].some((key) => !expected.has(key))) {
        throw new Error('Large-window identity set disagrees with paginated results.');
      }
    }
  }
  return { probes, largeWindowIdentitySetMatches: true };
}

async function main(): Promise<void> {
  const fixtureFlagIndex = process.argv.indexOf('--fixture');
  const fixturePath =
    fixtureFlagIndex >= 0 ? process.argv.at(fixtureFlagIndex + 1) : undefined;

  if (fixtureFlagIndex >= 0 && !fixturePath) {
    throw new Error('--fixture requires a JSON file path.');
  }

  const source = fixturePath ?? DEFAULT_ENDPOINT;
  if (fixturePath) {
    const envelope = parseEnvelope(JSON.parse(await readFile(fixturePath, 'utf8')));
    console.log(JSON.stringify(summarize(envelope, source), null, 2));
    return;
  }
  const result = await fetchAllLocations();
  const verification = process.argv.includes('--verify-coverage')
    ? await verifyCoverage(result.envelope.data) : undefined;
  console.log(JSON.stringify({
    observedAt: new Date().toISOString(),
    ...summarize(result.envelope, source),
    pagination: result.pagination,
    verification,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch((error: unknown) => {
  console.error(`OCPI investigation failed: ${String(error)}`);
  process.exitCode = 1;
});
