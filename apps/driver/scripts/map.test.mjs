import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = async (file) => ts.transpileModule(
  await readFile(new URL(`../src/features/map/${file}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const typesUrl = moduleUrl(await compile('types'));
const { isMapStation, toGeoJSON, getAvailability } = await import(typesUrl);
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const { fetchMapStations } = await import(moduleUrl(
  (await compile('api')).replace("'./types'", JSON.stringify(typesUrl)),
));
// Synthetic unit fixture only; never sent to Supabase or presented as live data.
const station = {
  location_id: '00000000-0000-0000-0000-000000000001', name: null,
  operator_name: null, address: null, city: null, latitude: 54.68, longitude: 25.28,
  total_evse_count: 2, available_evse_count: 1, charging_evse_count: 1,
  unavailable_evse_count: 0, unknown_evse_count: 0,
  connector_types: ['IEC_62196_T2'], max_power_kw: 22,
  last_observed_at: '2026-10-09T21:52:03.348Z',
};
const reply = (rows, range) => new Response(JSON.stringify(rows), {
  headers: { 'content-range': range, 'content-type': 'application/json' },
});

test('validates coordinates, counts, connectors and observation timestamps', () => {
  assert.ok(isMapStation(station));
  for (const patch of [{ latitude: NaN }, { longitude: 181 },
    { total_evse_count: 3 }, { available_evse_count: -1 },
    { connector_types: [42] }, { last_observed_at: 'invalid' }]) {
    assert.equal(isMapStation({ ...station, ...patch }), false);
  }
});

test('availability and GeoJSON preserve observed EVSE counts and coordinates', () => {
  assert.equal(getAvailability(station), 'available');
  assert.equal(getAvailability({ ...station, available_evse_count: 0 }), 'occupied');
  const feature = toGeoJSON([station]).features[0];
  assert.deepEqual(feature.geometry.coordinates, [25.28, 54.68]);
  assert.equal(feature.properties.total_evse_count, 2);
});

test('pages capped responses with a public apikey and no Bearer credential', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const second = { ...station, location_id: '00000000-0000-0000-0000-000000000002' };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return calls.length === 1 ? reply([station], '0-0/2') : reply([second], '1-1/2');
  };
  try {
    assert.equal((await fetchMapStations([25, 54, 26, 55])).length, 2);
    assert.match(calls[1].url, /offset=1$/);
    assert.equal(calls[0].init.headers.apikey, 'sb_publishable_test');
    assert.equal(calls[0].init.headers.Authorization, undefined);
  } finally { globalThis.fetch = original; }
});

test('empty responses succeed; invalid, duplicate, incomplete and oversized responses fail', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => reply([], '*/0');
    assert.deepEqual(await fetchMapStations([25, 54, 26, 55]), []);
    for (const [rows, range] of [[[{}], '0-0/1'], [[], '*/2'],
      [[station], '0-0/2001'], [[station, station], '0-1/2']]) {
      globalThis.fetch = async () => reply(rows, range);
      await assert.rejects(fetchMapStations([25, 54, 26, 55]));
    }
    globalThis.fetch = async () => new Response('private diagnostics', { status: 500 });
    await assert.rejects(fetchMapStations([25, 54, 26, 55]), (e) =>
      e.status === 500 && !e.message.includes('private diagnostics'));
  } finally { globalThis.fetch = original; }
});
