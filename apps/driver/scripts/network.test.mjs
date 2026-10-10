import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';

const url = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile = async (file) => ts.transpileModule(await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const types = url(await compile('features/map/types.ts'));
const routing = url(ts.transpileModule(await readFile(new URL('../../../packages/routing/index.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const congestion = url((await compile('features/map/congestion.ts')).replace("'./types'", JSON.stringify(types))
  .replace("'../../../../../packages/routing'", JSON.stringify(routing)));
const overviewModule = url((await compile('features/network/overview.ts')).replace("'../map/congestion'", JSON.stringify(congestion)));
const { networkOverview, NETWORK_BOUNDS, isFreshObservation } = await import(overviewModule);
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
const api = url((await compile('features/map/api.ts')).replace("'./types'", JSON.stringify(types)));
const capacity = url((await compile('features/map/capacityApi.ts')).replace("'./congestion'", JSON.stringify(congestion)).replace("'./api'", JSON.stringify(api)));
const { fetchNetworkEvidence } = await import(url((await compile('features/network/networkApi.ts'))
  .replace("'../map/api'", JSON.stringify(api)).replace("'../map/capacityApi'", JSON.stringify(capacity))
  .replace("'../../../../../packages/routing'", JSON.stringify(routing)).replace("'./overview'", JSON.stringify(overviewModule))));
const now = Date.parse('2026-10-10T08:00:00Z');
const ccs = 'IEC_62196_T2_COMBO', type2 = 'IEC_62196_T2';
const uuid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const evse = (id, status, standards = [ccs], time = now) => ({ id: uuid(id), status,
  connector_standards: standards, observed_at: new Date(time).toISOString() });
const row = (id, evses, operator = 'Synthetic A', lat = 54.70, lng = 25.28) => ({ station: {
  location_id: uuid(id), name: `Synthetic ${id}`, operator_name: operator, address: null, city: 'Vilnius',
  latitude: lat, longitude: lng, total_evse_count: evses.length,
  available_evse_count: evses.filter((e) => e.status === 'AVAILABLE').length,
  charging_evse_count: evses.filter((e) => e.status === 'CHARGING').length,
  unavailable_evse_count: evses.filter((e) => ['BLOCKED', 'INOPERATIVE', 'OUTOFORDER', 'REMOVED'].includes(e.status)).length,
  unknown_evse_count: evses.filter((e) => ['UNKNOWN', 'PLANNED', 'RESERVED'].includes(e.status)).length,
  connector_types: [...new Set(evses.flatMap((e) => e.connector_standards))], max_power_kw: null,
  last_observed_at: evses[0]?.observed_at ?? null,
}, evses });

test('network counts canonical compatible EVSEs once and partitions all statuses', () => {
  const statuses = ['AVAILABLE', 'CHARGING', 'UNKNOWN', 'BLOCKED', 'RESERVED', 'INOPERATIVE', 'OUTOFORDER', 'PLANNED', 'REMOVED'];
  const rows = [row(1, statuses.map((s, i) => evse(i + 1, s, [ccs, ccs, type2]))), row(2, [evse(100, 'AVAILABLE', [type2])])];
  const view = networkOverview(rows, ccs, now);
  assert.equal(view.locations, 1); assert.equal(view.evses, 9);
  assert.deepEqual([view.available, view.charging, view.unknown, view.otherUnavailable], [1, 1, 1, 6]);
  assert.equal(view.fresh, 9); assert.equal(view.freshAvailable, 1);
  assert.equal(networkOverview(rows, type2, now).evses, 10);
  assert.equal(networkOverview([rows[0], rows[0]], ccs, now).evses, 9);
  assert.equal(networkOverview([rows[0], rows[0]], ccs, now).locations, 1);
});
test('network scopes every count and pair to the explicit geographic window', () => {
  const view = networkOverview([row(1, [evse(1, 'CHARGING')]), row(2, [evse(2, 'AVAILABLE')], 'B', 55.0)], ccs, now);
  assert.equal(view.locations, 1); assert.equal(view.evses, 1); assert.equal(view.pairs.length, 0);
  assert.deepEqual(NETWORK_BOUNDS, [25.20, 54.64, 25.36, 54.76]);
});
test('cross-operator pairs require known different names and fresh compatible spare capacity', () => {
  const rows = [row(1, [evse(1, 'CHARGING')]), row(2, [evse(2, 'AVAILABLE')], 'B', 54.701),
    row(3, [evse(3, 'AVAILABLE')], ' synthetic a ', 54.702), row(4, [evse(4, 'AVAILABLE')], null, 54.703),
    row(5, [evse(5, 'AVAILABLE', [type2])], 'C', 54.704)];
  const view = networkOverview(rows, ccs, now);
  assert.equal(view.pairs.length, 3); assert.equal(view.pairs.filter((p) => p.crossOperator).length, 1);
  assert.equal(view.pairs[0].alternative.station.operator_name, 'B');
  assert.equal(view.pairs[0].available, 1); assert.equal(view.pairs[0].occupied, 1);
  assert.ok(view.pairs[0].distanceKm > 0 && view.pairs[0].distanceKm < 1);
});
test('stale totals remain dated and supply no fresh opportunities or capacity', () => {
  const rows = [row(1, [evse(1, 'CHARGING', [ccs], now - 3600001)]), row(2, [evse(2, 'AVAILABLE', [ccs], now - 3600001)], 'B', 54.701)];
  const view = networkOverview(rows, ccs, now);
  assert.equal(view.available, 1); assert.equal(view.freshAvailable, 0); assert.equal(view.stale, 2);
  assert.equal(view.pairs.length, 0); assert.equal(view.congestedLocations, 0);
  assert.equal(view.historicalPairs.length, 1); assert.equal(view.historicalPairs[0].historical, true);
  assert.equal(view.historicalPairs[0].evaluatedAt, now - 3600001);
  assert.equal(rows[0].evses[0].observed_at, new Date(now - 3600001).toISOString());
});
test('future, invalid and asynchronous old observations cannot invent historical pairs', () => {
  const invalid = evse(3, 'CHARGING'); invalid.observed_at = 'invalid';
  const rows = [row(1, [evse(1, 'CHARGING', [ccs], now + 1), invalid]), row(2, [evse(2, 'AVAILABLE')], 'B', 54.701)];
  const view = networkOverview(rows, ccs, now);
  assert.equal(view.pairs.length, 0); assert.equal(view.historicalPairs.length, 0); assert.equal(view.stale, 2);
  assert.equal(isFreshObservation(new Date(now - 3600000).toISOString(), now), true);
  assert.equal(isFreshObservation(new Date(now + 1).toISOString(), now), false);
  const asynchronous = networkOverview([row(1, [evse(1, 'CHARGING', [ccs], now - 7200000)]), rows[1]], ccs, now);
  assert.equal(asynchronous.historicalPairs.length, 0);
});
test('unknown and outage-only locations never establish congestion', () => {
  for (const status of ['UNKNOWN', 'OUTOFORDER', 'INOPERATIVE', 'PLANNED', 'REMOVED']) {
    const view = networkOverview([row(1, [evse(1, status)]), row(2, [evse(2, 'AVAILABLE')], 'B', 54.701)], ccs, now);
    assert.equal(view.pairs.length, 0); assert.equal(view.historicalPairs.length, 0);
  }
});
test('empty and incompatible selections contain no invented metrics or timestamps', () => {
  for (const records of [[], [row(1, [evse(1, 'AVAILABLE', [type2])])]]) {
    const view = networkOverview(records, ccs, now);
    assert.equal(view.evses, 0); assert.equal(view.locations, 0); assert.equal(view.newest, null); assert.equal(view.oldest, null);
    assert.equal(view.pairs.length, 0); assert.equal(view.historicalPairs.length, 0);
  }
});
test('bounded network load uses existing read APIs, clips radius evidence and never routes', async () => {
  const original = globalThis.fetch;
  const rows = [row(1, [evse(1, 'CHARGING')]), row(2, [evse(2, 'AVAILABLE')], 'B', 54.701), row(3, [evse(3, 'AVAILABLE')], 'C', 54.77)];
  const paths = [];
  try {
    globalThis.fetch = async (path, init) => {
      paths.push(path); assert.equal(init.method, 'POST'); assert.equal(init.headers.apikey, 'sb_publishable_fixture');
      if (path.includes('get_map_stations')) {
        assert.deepEqual(JSON.parse(init.body), { min_lng: 25.20, max_lng: 25.36, min_lat: 54.64, max_lat: 54.76 });
        return Response.json(rows.slice(0, 2).map((r) => r.station), { headers: { 'content-range': '0-1/2' } });
      }
      assert.ok(path.includes('get_station_capacity'));
      assert.equal(JSON.parse(init.body).target_location_id, uuid(1));
      return Response.json(rows, { headers: { 'content-range': '0-2/3' } });
    };
    const result = await fetchNetworkEvidence();
    assert.equal(result.records.length, 2); assert.equal(result.mappedLocations, 2);
    assert.equal(paths.length, 2); assert.ok(!paths.some((p) => p.includes('routing')));
  } finally { globalThis.fetch = original; }
});
test('empty map avoids capacity calls and read failures propagate without retries', async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; return Response.json([], { headers: { 'content-range': '*/0' } }); };
    assert.equal((await fetchNetworkEvidence()).records.length, 0); assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
    await assert.rejects(fetchNetworkEvidence()); assert.equal(calls, 2);
    globalThis.fetch = async () => { throw new Error('offline'); };
    await assert.rejects(fetchNetworkEvidence(), /offline/);
  } finally { globalThis.fetch = original; }
});

// Render the actual dashboard through React Native Web with controlled external
// data/loading/error state. These are render checks, not interactive browser proof.
const nativeWeb = createRequire(import.meta.url)('react-native-web');
globalThis.networkRenderFixture = { nativeWeb, width: 1280, state: [], index: 0 };
const reactHooks = url(`
export const useEffect = () => {};
export const useMemo = (fn) => fn();
export const useState = () => { const f = globalThis.networkRenderFixture; return [f.state[f.index++], () => {}]; };
`);
const nativeModule = url(`
export const { Pressable, ScrollView, StyleSheet, Text, View } = globalThis.networkRenderFixture.nativeWeb;
export const useWindowDimensions = () => ({width:globalThis.networkRenderFixture.width,height:900});
`);
const tokens = url(await compile('features/map/tokens.ts'));
const noNetwork = url('export const fetchNetworkEvidence = () => { throw new Error("Render must not fetch"); };');
const dashboardSource = ts.transpileModule(await readFile(new URL('../src/features/network/NetworkDashboard.tsx', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const { NetworkDashboard } = await import(url(dashboardSource
  .replace('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')))
  .replace("'react'", JSON.stringify(reactHooks)).replace("'react-native'", JSON.stringify(nativeModule))
  .replace("'../map/congestion'", JSON.stringify(congestion)).replace("'../map/tokens'", JSON.stringify(tokens))
  .replace("'./networkApi'", JSON.stringify(noNetwork)).replace("'./overview'", JSON.stringify(overviewModule))));
const render = (records, width = 1280, loading = false, error = null) => {
  globalThis.networkRenderFixture.width = width;
  globalThis.networkRenderFixture.index = 0;
  globalThis.networkRenderFixture.state = [ccs, { records, mappedLocations: records.length, anchor: records[0]?.station ?? null,
    fetchedAt: new Date(now).toISOString() }, loading, error, 0, now];
  return renderToStaticMarkup(React.createElement(NetworkDashboard));
};
test('dashboard renders loading, error and empty states with an explicit refresh action', () => {
  assert.match(render([], 1280, true), /Loading network observations/);
  assert.match(render([], 1280, false, 'Read failed'), /Read failed/);
  assert.match(render([]), /No compatible observations/);
  assert.match(render([]), /No CCS2 evidence/);
  assert.match(render([]), /Reload saved observations/);
});
test('dashboard desktop and mobile renders retain evidence, status labels and geographic pair', () => {
  const rows = [row(1, [evse(1, 'CHARGING')]), row(2, [evse(2, 'AVAILABLE')], 'Synthetic B', 54.701)];
  for (const width of [360, 768, 1280]) {
    const html = render(rows, width);
    for (const label of ['Distinct EVSEs', 'AVAILABLE', 'CHARGING', 'UNKNOWN', 'Other unavailable', 'Synthetic A', 'Synthetic B', 'straight-line', 'Coverage &amp; evidence']) {
      assert.ok(html.includes(label), `Missing ${label} at width ${width}`);
    }
    assert.match(html, /fresh cross-operator pairs/);
    assert.ok(html.includes(`width:${width >= 900 ? '15.4%' : width >= 550 ? '31%' : '47%'}`), `Metric width at ${width}`);
  }
});
test('stale dashboard render clearly dates the pair and withholds fresh capacity', () => {
  const rows = [row(1, [evse(1, 'CHARGING', [ccs], now - 7200000)]), row(2, [evse(2, 'AVAILABLE', [ccs], now - 7200000)], 'B', 54.701)];
  const html = render(rows);
  assert.match(html, /DATED SNAPSHOT PATTERN · NOT CURRENT AVAILABILITY/);
  assert.match(html, /Current availability unverified/);
  assert.match(html, /refresh source observations before acting/);
  assert.match(html, /fetching does not renew source observations/);
});
