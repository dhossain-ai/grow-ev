import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url, 'https://heafsrqaytsfthfcxmqu.supabase.co');
assert.ok(key?.startsWith('sb_publishable_'), 'Publishable key required');
const moduleUrl = (s) => `data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
const compile = async (file) => ts.transpileModule(
  await readFile(new URL(`../src/features/map/${file}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const typesUrl = moduleUrl(await compile('types'));
const { fetchMapStations } = await import(moduleUrl(
  (await compile('api')).replace("'./types'", JSON.stringify(typesUrl)),
));
const headers = { apikey: key, 'Content-Type': 'application/json' };
const request = (path, init = {}) => fetch(`${url}/rest/v1/${path}`, {
  ...init, headers, signal: AbortSignal.timeout(30000),
});

try {
  const national = await fetchMapStations([-180, -90, 180, 90], undefined, AbortSignal.timeout(30000));
  const vilnius = await fetchMapStations([25.1, 54.5, 25.5, 54.9], undefined, AbortSignal.timeout(30000));
  assert.ok(national.length > 1000 && national.length <= 2000);
  assert.ok(vilnius.length > 0);
  assert.ok(vilnius.every((s) => s.latitude >= 54.5 && s.latitude <= 54.9 &&
    s.longitude >= 25.1 && s.longitude <= 25.5));
  const allowed = ['location_id', 'name', 'operator_name', 'address', 'city', 'latitude',
    'longitude', 'total_evse_count', 'available_evse_count', 'charging_evse_count',
    'unavailable_evse_count', 'unknown_evse_count', 'connector_types', 'max_power_kw', 'last_observed_at'];
  assert.ok(national.every((s) => Object.keys(s).every((k) => allowed.includes(k))));
  for (const body of [{ min_lng: 26, max_lng: 25 }, { min_lat: null },
    { min_lat: -91 }, { min_lng: 'NaN' }, { min_power_kw: 1001 },
    { connector_standards: Array(33).fill('CCS') }]) {
    const r = await request('rpc/get_map_stations', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).code, '22023');
  }
  for (const table of ['charging_locations', 'charging_evses', 'charging_connectors',
    'source_poll_runs', 'evse_status_transitions']) {
    assert.equal((await request(`${table}?select=*&limit=1`)).status, 401);
    // Empty insert payload cannot create data, even if the permission check regresses.
    assert.equal((await request(table, { method: 'POST', body: '[]' })).status, 401);
  }
  console.log(JSON.stringify({ result: 'PASS', nationalStations: national.length,
    nationalEvses: national.reduce((n, s) => n + s.total_evse_count, 0),
    vilniusBoundsStations: vilnius.length,
    vilniusBoundsEvses: vilnius.reduce((n, s) => n + s.total_evse_count, 0),
    observationTimes: [...new Set(national.map((s) => s.last_observed_at))],
    checks: ['pagination', 'bounds', 'public field allowlist', 'invalid queries',
      'anonymous table read denial', 'anonymous insert denial'] }));
} catch (error) {
  console.error('Live map verification failed:', error instanceof Error ? error.name : 'unknown');
  process.exitCode = 1;
}
