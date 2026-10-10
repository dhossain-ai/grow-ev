import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async (file) => ts.transpileModule(
  await readFile(new URL(`../src/features/map/${file}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const typesUrl = moduleUrl(await compile('types'));
const routingUrl = moduleUrl(ts.transpileModule(await readFile(new URL('../../../packages/routing/index.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const congestionUrl = moduleUrl((await compile('congestion')).replace("'./types'", JSON.stringify(typesUrl))
  .replace("'../../../../../packages/routing'", JSON.stringify(routingUrl)));
const { compatibleCapacity, findAlternatives, isStationEvidence, straightLineKm, CONNECTOR_OPTIONS, FRESHNESS_MS } = await import(congestionUrl);
const apiUrl = moduleUrl((await compile('api')).replace("'./types'", JSON.stringify(typesUrl)));
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
const { fetchStationCapacity } = await import(moduleUrl((await compile('capacityApi'))
  .replace("'./congestion'", JSON.stringify(congestionUrl)).replace("'./api'", JSON.stringify(apiUrl))));

// Synthetic unit fixtures, never written to Supabase or represented as real measurements.
const now = Date.parse('2026-10-10T08:00:00Z');
const ccs = 'IEC_62196_T2_COMBO';
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const evse = (n, status, connectors = [ccs], observed_at = new Date(now).toISOString()) =>
  ({ id: uuid(n), status, connector_standards: connectors, observed_at });
const evidence = (n, evses, latitude = 54.68) => ({ station: {
  location_id: uuid(n), name: `Synthetic ${n}`, operator_name: 'Test operator', address: null, city: null,
  latitude, longitude: 25.28, total_evse_count: evses.length,
  available_evse_count: evses.filter((e) => e.status === 'AVAILABLE').length,
  charging_evse_count: evses.filter((e) => e.status === 'CHARGING').length,
  unavailable_evse_count: evses.filter((e) => ['BLOCKED', 'INOPERATIVE', 'OUTOFORDER', 'REMOVED'].includes(e.status)).length,
  unknown_evse_count: evses.filter((e) => ['UNKNOWN', 'PLANNED', 'RESERVED'].includes(e.status)).length,
  connector_types: [...new Set(evses.flatMap((e) => e.connector_standards))], max_power_kw: null,
  last_observed_at: new Date(now).toISOString(),
}, evses });
const capacity = (rows) => compatibleCapacity(evidence(1, rows), ccs, now);

test('labels map to exact OCPI standards', () => {
  assert.deepEqual(CONNECTOR_OPTIONS.map((c) => [c.label, c.value]),
    [['CCS2', ccs], ['Type 2', 'IEC_62196_T2'], ['CHAdeMO', 'CHADEMO']]);
});
test('incompatible available EVSE never supplies compatible capacity', () => {
  const result = capacity([evse(11, 'AVAILABLE', ['IEC_62196_T2']), evse(12, 'CHARGING')]);
  assert.equal(result.available, 0);
  assert.equal(result.state, 'congested');
  assert.equal(capacity([evse(11, 'AVAILABLE', ['CHADEMO'])]).state, 'no-compatible');
});
test('multiple connectors and repeated standards count distinct EVSEs', () => {
  const e = evse(11, 'AVAILABLE', [ccs, ccs, 'CHADEMO']);
  assert.equal(capacity([e, evse(12, 'AVAILABLE')]).available, 2);
  assert.equal(capacity([e, e]).available, 1);
});
test('charging, blocked and reserved qualify; available prevents congestion', () => {
  for (const status of ['CHARGING', 'BLOCKED', 'RESERVED']) assert.equal(capacity([evse(11, status)]).state, 'congested');
  assert.equal(capacity([evse(11, 'CHARGING'), evse(12, 'AVAILABLE')]).state, 'available');
});
test('unknown and outages are distinct from congestion; mixed uncertainty stays visible', () => {
  assert.equal(capacity([evse(11, 'UNKNOWN')]).state, 'unknown');
  for (const status of ['OUTOFORDER', 'INOPERATIVE', 'PLANNED', 'REMOVED']) assert.equal(capacity([evse(11, status)]).state, 'unavailable');
  const mixed = capacity([evse(11, 'CHARGING'), evse(12, 'UNKNOWN')]);
  assert.equal(mixed.state, 'congested');
  assert.equal(mixed.unknown, 1);
});
test('stale, invalid and future observations cannot prove availability or saturation', () => {
  for (const time of [new Date(now - FRESHNESS_MS - 1).toISOString(), 'invalid', new Date(now + 1).toISOString()]) {
    assert.equal(capacity([evse(11, 'AVAILABLE', [ccs], time)]).available, 0);
    assert.equal(capacity([evse(11, 'CHARGING', [ccs], time)]).state, 'stale');
  }
  assert.equal(capacity([evse(11, 'AVAILABLE', [ccs], new Date(now - FRESHNESS_MS).toISOString())]).available, 1);
  assert.equal(capacity([evse(11, 'CHARGING'), evse(12, 'AVAILABLE', [ccs], new Date(now - FRESHNESS_MS - 1).toISOString())]).state, 'stale');
});
test('alternatives require fresh compatible availability, radius, exclusion and deterministic top three ranking', () => {
  const target = evidence(1, [evse(11, 'CHARGING')]);
  const near = evidence(2, [evse(21, 'AVAILABLE')], 54.681);
  const tieMore = evidence(3, [evse(31, 'AVAILABLE'), evse(32, 'AVAILABLE')], 54.681);
  const farther = evidence(4, [evse(41, 'AVAILABLE')], 54.69);
  const fourth = evidence(5, [evse(51, 'AVAILABLE')], 54.70);
  const rows = [target, fourth, near, farther, tieMore,
    evidence(6, [evse(61, 'AVAILABLE', ['CHADEMO'])]),
    evidence(7, [evse(71, 'UNKNOWN')]),
    evidence(8, [evse(81, 'AVAILABLE', [ccs], new Date(now - FRESHNESS_MS - 1).toISOString())]),
    evidence(9, [evse(91, 'AVAILABLE')], 55)];
  assert.deepEqual(findAlternatives(target, rows, ccs, now).map((a) => a.evidence.station.location_id), [uuid(3), uuid(2), uuid(4)]);
  assert.equal(findAlternatives(near, rows, ccs, now).length, 0);
  assert.equal(findAlternatives(target, [target], ccs, now).length, 0);
  assert.equal(straightLineKm(target.station, target.station), 0);
  assert.ok(Math.abs(straightLineKm(target.station, farther.station) - 1.11195) < 0.001);
});
test('evidence validation rejects duplicate EVSEs, invalid status, missing capacity and malformed observations', () => {
  const row = evidence(1, [evse(11, 'AVAILABLE')]);
  assert.ok(isStationEvidence(row));
  for (const patch of [{ evses: [] }, { evses: [{ ...row.evses[0], status: 'invented' }] },
    { evses: [{ ...row.evses[0], observed_at: 'invalid' }] },
    { evses: [{ ...row.evses[0], connector_standards: [42] }] }]) assert.equal(isStationEvidence({ ...row, ...patch }), false);
  assert.equal(isStationEvidence(evidence(1, [row.evses[0], row.evses[0]])), false);
});
test('capacity API pages, sends public credentials and propagates cancellation', async () => {
  const original = globalThis.fetch;
  const target = evidence(1, [evse(11, 'CHARGING')]);
  const alt = evidence(2, [evse(21, 'AVAILABLE')]);
  const controller = new AbortController();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(calls.length === 1 ? [target] : [alt]), { headers: { 'content-range': `${calls.length - 1}-${calls.length - 1}/2` } });
  };
  try {
    assert.equal((await fetchStationCapacity(uuid(1), controller.signal)).length, 2);
    assert.match(calls[1].url, /offset=1$/);
    assert.equal(calls[0].init.signal, controller.signal);
    assert.equal(calls[0].init.headers.apikey, 'sb_publishable_test');
    assert.equal(calls[0].init.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(calls[0].init.body), { target_location_id: uuid(1) });
  } finally { globalThis.fetch = original; }
});
test('capacity API fails closed on missing target, duplicate, malformed, incomplete and HTTP errors', async () => {
  const original = globalThis.fetch;
  const target = evidence(1, [evse(11, 'CHARGING')]);
  try {
    for (const [rows, total] of [[[], 0], [[{}], 1], [[target, target], 2], [[], 2], [[target], 2001]]) {
      globalThis.fetch = async () => new Response(JSON.stringify(rows), { headers: { 'content-range': `*/${total}` } });
      await assert.rejects(fetchStationCapacity(uuid(1)));
    }
    globalThis.fetch = async () => new Response('private diagnostics', { status: 404 });
    await assert.rejects(fetchStationCapacity(uuid(1)), (e) => e.status === 404 && !e.message.includes('private diagnostics'));
  } finally { globalThis.fetch = original; }
});
