import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const routingUrl = moduleUrl(await compile('../../../packages/routing/index.ts'));
const typesUrl = moduleUrl(await compile('../src/features/map/types.ts'));
const congestionUrl = moduleUrl((await compile('../src/features/map/congestion.ts'))
  .replace("'./types'", JSON.stringify(typesUrl)).replace("'../../../../../packages/routing'", JSON.stringify(routingUrl)));
const { FRESHNESS_MS } = await import(congestionUrl);
const { recommendAlternatives } = await import(moduleUrl((await compile('../src/features/map/recommendations.ts'))
  .replace("'./congestion'", JSON.stringify(congestionUrl)).replace("'../../../../../packages/routing'", JSON.stringify(routingUrl))));
const { fetchDrivingRoutes, routingCandidates } = await import(moduleUrl((await compile('../src/features/map/routingApi.ts'))
  .replaceAll("'../../../../../packages/routing'", JSON.stringify(routingUrl))));

// Entirely synthetic evidence and mocked route HTTP; never a live measurement.
const now = Date.parse('2026-10-10T10:00:00Z');
const standard = 'IEC_62196_T2_COMBO';
const time = (age = 0) => new Date(now - age).toISOString();
const evse = (id, status = 'AVAILABLE', connectors = [standard], observed_at = time()) =>
  ({ id, status, connector_standards: connectors, observed_at });
const station = (id, latitude, evses) => ({
  station: { location_id: id, name: id, latitude, longitude: 25.28 }, evses,
});
const selected = station('selected', 54.68, [evse('selected-1', 'CHARGING')]);
const a = station('a', 54.681, [evse('a-1')]);
const b = station('b', 54.682, [evse('b-1'), evse('b-2')]);
const c = station('c', 54.683, [evse('c-1')]);
const coord = (evidence) => ({ lat: evidence.station.latitude, lng: evidence.station.longitude });
const route = (evidence, seconds, origin = coord(selected), patch = {}) => ({ route: {
  origin, destination: coord(evidence), drivingDurationSeconds: seconds,
  roadDistanceMeters: 2800, trafficAware: true, provider: 'tomtom', calculatedAt: time(), ...patch,
} });
const recommend = (rows = [a, b, c], outcomes = {}, origin) =>
  recommendAlternatives(selected, rows, standard, now, outcomes, origin);
const ids = (result) => result.recommendations.map((r) => r.evidence.station.location_id);

test('fresh congestion gives one primary and up to two compatible available alternatives', () => {
  const result = recommend([c, b, a, station('fourth', 54.684, [evse('fourth-1')])]);
  assert.equal(result.selectedCapacity.state, 'congested');
  assert.deepEqual(ids(result), ['a', 'b', 'c']);
  assert.equal(result.rankingBasis, 'geographic-proximity');
  assert.equal(result.originKind, 'selected-charger');
  assert.ok(result.recommendations.every((r) => r.capacity.available > 0 && r.route === null && r.drivingDifferenceSeconds === null));
});
test('incompatible AVAILABLE, UNKNOWN, outages and outside-radius stations are excluded', () => {
  const rows = [a, station('incompatible', 54.6801, [evse('i-1', 'AVAILABLE', ['CHADEMO'])]),
    ...['UNKNOWN', 'OUTOFORDER', 'INOPERATIVE', 'PLANNED', 'REMOVED', 'RESERVED', 'BLOCKED', 'CHARGING']
      .map((status, i) => station(status, 54.6802, [evse(`state-${i}`, status)])),
    station('far', 55, [evse('far-1')])];
  assert.deepEqual(ids(recommend(rows)), ['a']);
});
test('stale/future/invalid observations never provide usable capacity; freshness ceiling is strict', () => {
  for (const observed of [time(FRESHNESS_MS + 1), time(-1), 'invalid']) {
    assert.deepEqual(ids(recommend([station('stale', 54.681, [evse('s-1', 'AVAILABLE', [standard], observed)])])), []);
    const staleSelected = station('selected', 54.68, [evse('selected-1', 'CHARGING', [standard], observed)]);
    assert.deepEqual(recommendAlternatives(staleSelected, [a], standard, now).recommendations, []);
  }
  const boundary = station('boundary', 54.681, [evse('boundary-1', 'AVAILABLE', [standard], time(FRESHNESS_MS))]);
  assert.equal(recommend([boundary]).recommendations[0].capacity.available, 1);
  assert.deepEqual(recommendAlternatives(selected, [boundary], standard, now + 1).recommendations, []);
});
test('available/unknown/out-of-service selected stations do not invent congestion or require rerouting', () => {
  for (const status of ['AVAILABLE', 'UNKNOWN', 'OUTOFORDER', 'INOPERATIVE']) {
    const target = station('selected', 54.68, [evse('selected-1', status)]);
    const result = recommendAlternatives(target, [a], standard, now);
    assert.notEqual(result.selectedCapacity.state, 'congested');
    assert.equal(result.recommendations.length, 0);
  }
});
test('multiple connectors count a canonical EVSE once; mixed uncertainty remains visible', () => {
  const mixed = station('mixed', 54.681, [evse('m-1', 'AVAILABLE', [standard, 'CHADEMO', standard]),
    evse('m-2', 'UNKNOWN'), evse('m-3', 'AVAILABLE', [standard], time(FRESHNESS_MS + 1))]);
  const r = recommend([mixed]).recommendations[0];
  assert.equal(r.capacity.available, 1);
  assert.equal(r.capacity.unknown, 1);
  assert.equal(r.capacity.stale, 1);
  assert.ok(r.reasons.includes('1 CCS2-compatible EVSE observed AVAILABLE.'));
  assert.ok(r.reasons.includes('1 stale/invalid and 1 unknown compatible EVSEs excluded from the available count.'));
});
test('complete fresh routes rank by estimated driving time and explain deltas from the primary', () => {
  const result = recommend([a, b, c], { a: route(a, 480), b: route(b, 180), c: route(c, 240) });
  assert.equal(result.rankingBasis, 'driving-time');
  assert.deepEqual(ids(result), ['b', 'c', 'a']);
  assert.deepEqual(result.recommendations.map((r) => r.drivingDifferenceSeconds), [0, 60, 300]);
  assert.ok(result.recommendations[1].reasons.includes('1.0 min longer estimated drive than the primary recommendation from the same origin.'));
  assert.ok(result.recommendations[0].reasons.includes('Charger-to-charger travel: 3.0 min estimated drive; 2.8 km by road.'));
});
test('ties resolve by geography, available count and stable ID, independent of input order', () => {
  const z = station('z', a.station.latitude, [evse('z-1'), evse('z-2')]);
  const y = station('y', a.station.latitude, [evse('y-1'), evse('y-2')]);
  const rows = [a, z, y];
  const outcomes = { a: route(a, 180), z: route(z, 180), y: route(y, 180) };
  for (const order of [rows, [...rows].reverse()]) {
    assert.deepEqual(ids(recommend(order)), ['y', 'z', 'a']);
    assert.deepEqual(ids(recommend(order, outcomes)), ['y', 'z', 'a']);
  }
});
test('partial routing retains geographic order while showing comparable known differences', () => {
  const result = recommend([a, b, c], { a: route(a, 480), b: route(b, 180) });
  assert.equal(result.rankingBasis, 'geographic-proximity');
  assert.deepEqual(ids(result), ['a', 'b', 'c']);
  assert.equal(result.recommendations[1].drivingDifferenceSeconds, -300);
  assert.ok(result.recommendations[1].reasons.includes('5.0 min shorter estimated drive than the primary recommendation from the same origin.'));
  assert.equal(result.recommendations[2].route, null);
  assert.equal(result.recommendations[2].drivingDifferenceSeconds, null);
});
test('route failures, stale/future/malformed/wrong-origin/destination results never become ETAs', () => {
  const error = { error: { code: 'ROUTING_TIMEOUT', message: 'Driving time unavailable', retryable: true } };
  for (const outcome of [error, route(a, 0, coord(selected), { calculatedAt: time(120001) }),
    route(a, 0, coord(selected), { calculatedAt: time(-1) }), route(a, 0, coord(b)),
    route(a, 0, coord(selected), { destination: coord(b) }), route(a, -1),
    route(a, 0, coord(selected), { roadDistanceMeters: null })]) {
    const result = recommend([a], { a: outcome });
    assert.equal(result.rankingBasis, 'geographic-proximity');
    assert.equal(result.recommendations[0].route, null);
    assert.equal(result.recommendations[0].drivingDifferenceSeconds, null);
    assert.ok(result.recommendations[0].reasons.some((r) => r.startsWith('Driving time unavailable.')));
    assert.ok(result.recommendations[0].reasons.every((r) => !r.includes('estimated drive')));
  }
});
test('mixed traffic-awareness routes are displayed without comparing incompatible estimates', () => {
  const result = recommend([a, b], { a: route(a, 480), b: route(b, 180, coord(selected), { trafficAware: false }) });
  assert.equal(result.rankingBasis, 'geographic-proximity');
  assert.deepEqual(ids(result), ['a', 'b']);
  assert.equal(result.recommendations[1].drivingDifferenceSeconds, null);
});
test('provided actual user origin is distinct and cannot reuse charger-origin routes', () => {
  const origin = { lat: 54.677, lng: 25.27 };
  const wrong = recommend([a], { a: route(a, 180) }, origin);
  assert.equal(wrong.originKind, 'user-origin');
  assert.equal(wrong.recommendations[0].route, null);
  const result = recommend([a], { a: route(a, 180, origin) }, origin);
  assert.deepEqual(result.origin, origin);
  assert.ok(result.recommendations[0].reasons.includes('Travel from your provided origin: 3.0 min estimated drive; 2.8 km by road.'));
  const batch = routingCandidates(selected.station, result.recommendations, origin);
  assert.deepEqual(batch.origin, origin);
  assert.notDeepEqual(batch.origin, coord(selected));
  const invalid = recommend([a], { a: route(a, 180) }, null);
  assert.equal(invalid.origin, null);
  assert.equal(invalid.recommendations[0].route, null);
});
test('explanations retain exact compatible count, congestion, geography and oldest available observation', () => {
  const aged = station('aged', 54.681, [evse('aged-1', 'AVAILABLE', [standard], time(600000)),
    evse('aged-2', 'AVAILABLE', [standard], time(60000))]);
  const r = recommend([aged]).recommendations[0];
  assert.equal(r.capacity.observedAt, time(600000));
  assert.deepEqual(r.reasons.slice(0, 4), [
    '2 CCS2-compatible EVSEs observed AVAILABLE.',
    'Selected charger: no compatible AVAILABLE EVSE; 1 charging, blocked or reserved.',
    `${r.distanceKm.toFixed(1)} km straight-line from the selected charger.`,
    'Oldest available observation: 10 min ago; within the 60-minute freshness limit.',
  ]);
  assert.ok(!r.reasons.some((s) => /probability|price|wait time|charging duration|saving/i.test(s)));
});
test('mocked routing HTTP reranks by station identity and preserves primary/alternative selection', async () => {
  const original = globalThis.fetch;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
  const localNow = Date.now();
  const fresh = (evidence, seconds) => route(evidence, seconds, coord(selected), { calculatedAt: new Date(localNow).toISOString() });
  try {
    const initial = recommend();
    globalThis.fetch = async (_url, init) => {
      assert.deepEqual(JSON.parse(init.body).destinations, [coord(a), coord(b), coord(c)]);
      return Response.json({ results: [fresh(a, 480), fresh(b, 180), fresh(c, 240)] });
    };
    const results = await fetchDrivingRoutes(routingCandidates(selected.station, initial.recommendations));
    // Evse times stay fresh in the controlled test's local clock.
    const rows = [a, b, c].map((s) => ({ ...s, evses: s.evses.map((e) => ({ ...e, observed_at: new Date(localNow).toISOString() })) }));
    const target = { ...selected, evses: selected.evses.map((e) => ({ ...e, observed_at: new Date(localNow).toISOString() })) };
    const outcomes = Object.fromEntries(initial.recommendations.map((r, i) => [r.evidence.station.location_id, results[i]]));
    const final = recommendAlternatives(target, rows, standard, localNow, outcomes);
    assert.deepEqual(ids(final), ['b', 'c', 'a']);
    assert.equal(final.recommendations[0].evidence.station.location_id, 'b');
    assert.equal(final.recommendations[1].route.destination.lat, c.station.latitude);
  } finally { globalThis.fetch = original; }
});
