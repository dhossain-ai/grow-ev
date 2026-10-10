import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const sharedUrl = url(await compile('../../../packages/routing/index.ts'));
const tomtomUrl = url((await compile('../../../supabase/functions/routing/tomtom.ts'))
  .replace("'../../../packages/routing/index.ts'", JSON.stringify(sharedUrl)));
const { TomTomRoutingProvider, RoutingError } = await import(tomtomUrl);
const { createRoutingHandler } = await import(url((await compile('../../../supabase/functions/routing/handler.ts'))
  .replace("'../../../packages/routing/index.ts'", JSON.stringify(sharedUrl)).replace("'./tomtom.ts'", JSON.stringify(tomtomUrl))));
const { geographicDistanceMeters, isRoutingBatchRequest } = await import(sharedUrl);
const { fetchDrivingRoutes, routingCandidates } = await import(url((await compile('../src/features/map/routingApi.ts'))
  .replaceAll("'../../../../../packages/routing'", JSON.stringify(sharedUrl))));
const typesUrl = url(await compile('../src/features/map/types.ts'));
const { findAlternatives } = await import(url((await compile('../src/features/map/congestion.ts'))
  .replace("'./types'", JSON.stringify(typesUrl)).replace("'../../../../../packages/routing'", JSON.stringify(sharedUrl))));

// Controlled fixtures only; no HTTP network or database writes.
const now = Date.parse('2026-10-10T10:00:00Z');
const origin = { lat: 54.68, lng: 25.28 };
const destination = { lat: 54.69, lng: 25.29 };
const request = { origin, destination };
const batch = { origin, destinations: [destination] };
const payload = { routes: [{ summary: { travelTimeInSeconds: 420, lengthInMeters: 2800,
  noTrafficTravelTimeInSeconds: 240, historicTrafficTravelTimeInSeconds: 360, liveTrafficIncidentsTravelTimeInSeconds: 420 } }] };
const route = { ...request, drivingDurationSeconds: 420, roadDistanceMeters: 2800,
  trafficAware: true, provider: 'tomtom', calculatedAt: new Date(now).toISOString() };
const post = (body = batch) => new Request('https://example.invalid/functions/v1/routing', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const failureCode = (code) => (error) => error instanceof RoutingError && error.failure.code === code;

test('normalizes TomTom traffic duration and road distance without substituting free flow', async () => {
  const provider = new TomTomRoutingProvider('fixture-key', async (value, init) => {
    const u = new URL(value);
    assert.match(u.pathname, /54.68,25.28:54.69,25.29/);
    for (const [key, value] of Object.entries({ traffic: 'true', departAt: 'now', travelMode: 'car', computeTravelTimeFor: 'all', routeRepresentation: 'summaryOnly' }))
      assert.equal(u.searchParams.get(key), value);
    assert.ok(init.signal);
    assert.equal(init.redirect, 'error');
    return Response.json(payload);
  }, 8000, () => now);
  assert.deepEqual(await provider.calculate(request), route);
  assert.notEqual(geographicDistanceMeters(origin, destination), route.roadDistanceMeters);
});
test('invalid and distant coordinates and missing credentials never call HTTP', async () => {
  let count = 0;
  const provider = new TomTomRoutingProvider(undefined, async () => { count++; return Response.json(payload); });
  for (const point of [{ lat: 91, lng: 25 }, { lat: 54, lng: 181 }, { lat: NaN, lng: 25 }, { lat: '54', lng: 25 }, { lat: 0, lng: 0 }])
    await assert.rejects(provider.calculate({ origin, destination: point }), failureCode('INVALID_INPUT'));
  await assert.rejects(provider.calculate(request), failureCode('ROUTING_NOT_CONFIGURED'));
  assert.equal(count, 0);
  for (const body of [{ ...batch, destinations: [] }, { ...batch, destinations: Array(4).fill(destination) },
    { ...batch, destinations: [destination, destination] }, { origin: null, destinations: [destination] }])
    assert.equal(isRoutingBatchRequest(body), false);
});
test('timeout aborts HTTP and returns a sanitized timeout', async () => {
  const provider = new TomTomRoutingProvider('fixture-key', async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('private URL fixture-key')), { once: true });
  }), 5);
  await assert.rejects(provider.calculate(request), failureCode('ROUTING_TIMEOUT'));
});
test('API errors, rate limits, network and malformed responses fail closed', async () => {
  for (const status of [400, 401, 403, 404, 500, 503, 429]) {
    const provider = new TomTomRoutingProvider('fixture-key', async () => new Response('private diagnostics fixture-key', { status }));
    await assert.rejects(provider.calculate(request), (e) => e.failure.code === (status === 429 ? 'EXTERNAL_RATE_LIMITED' : 'ROUTING_UNAVAILABLE') && !e.message.includes('fixture-key'));
  }
  for (const data of [{}, { routes: [] }, { routes: [{ summary: { travelTimeInSeconds: 240, lengthInMeters: 1000 } }] },
    { routes: [{ summary: { ...payload.routes[0].summary, lengthInMeters: -1 } }] },
    { routes: [{ summary: { ...payload.routes[0].summary, travelTimeInSeconds: '420' } }] }]) {
    await assert.rejects(new TomTomRoutingProvider('fixture-key', async () => Response.json(data)).calculate(request), failureCode('ROUTING_UNAVAILABLE'));
  }
  await assert.rejects(new TomTomRoutingProvider('fixture-key', async () => { throw new Error('fixture-key'); }).calculate(request), failureCode('ROUTING_UNAVAILABLE'));
});
test('endpoint validates bodies/methods/CORS and preserves partial success and order', async () => {
  let calls = 0;
  const handler = createRoutingHandler({ calculate: async ({ origin, destination }) => {
    calls++;
    if (destination.lng === 25.3) throw new RoutingError({ code: 'ROUTING_UNAVAILABLE', message: 'Driving time unavailable', retryable: true }, 502);
    return { ...route, origin, destination };
  } }, () => now);
  assert.equal((await handler(new Request('https://example.invalid', { method: 'OPTIONS' }))).status, 204);
  assert.equal((await handler(new Request('https://example.invalid'))).status, 405);
  for (const body of [{}, { ...batch, destinations: Array(4).fill(destination) }, { padding: 'x'.repeat(2048) }])
    assert.equal((await handler(post(body))).status, 400);
  assert.equal(calls, 0);
  const response = await handler(post({ origin, destinations: [destination, { lat: 54.69, lng: 25.3 }] }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const data = await response.json();
  assert.deepEqual(data.results[0], { route });
  assert.equal(data.results[1].error.code, 'ROUTING_UNAVAILABLE');
});
test('endpoint exposes missing credentials/timeout/provider limits and applies backoff', async () => {
  for (const [code, status] of [['ROUTING_NOT_CONFIGURED', 503], ['ROUTING_TIMEOUT', 504], ['EXTERNAL_RATE_LIMITED', 429]]) {
    let calls = 0;
    const handler = createRoutingHandler({ calculate: async () => { calls++; throw new RoutingError({ code, message: 'Driving time unavailable', retryable: true }, status); } }, () => now);
    const response = await handler(post());
    assert.equal(response.status, status);
    assert.equal((await response.json()).error.code, code);
    if (status === 429) { assert.equal((await handler(post())).status, 429); assert.equal(calls, 1); }
  }
});
test('endpoint enforces per-isolate budget and window reset', async () => {
  let clock = now;
  const handler = createRoutingHandler({ calculate: async () => route }, () => clock);
  for (let n = 0; n < 30; n++) assert.equal((await handler(post())).status, 200);
  const limited = await handler(post());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  clock += 60000;
  assert.equal((await handler(post())).status, 200);
});
test('endpoint bounds concurrent batches', async () => {
  const releases = [];
  const handler = createRoutingHandler({ calculate: () => new Promise((resolve) => releases.push(() => resolve(route))) }, () => now);
  const a = handler(post());
  const b = handler(post());
  // Let both parsed requests enter the provider.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal((await handler(post())).status, 429);
  releases.forEach((release) => release());
  assert.equal((await a).status, 200);
  assert.equal((await b).status, 200);
});
test('client uses only public credentials and validates association, age and errors', async () => {
  const original = globalThis.fetch;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_fixture';
  const freshRoute = { ...route, calculatedAt: new Date().toISOString() };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'https://example.invalid/functions/v1/routing');
      assert.equal(init.headers.apikey, 'sb_publishable_fixture');
      assert.equal(init.headers.Authorization, undefined);
      assert.deepEqual(JSON.parse(init.body), batch);
      return Response.json({ results: [{ route: freshRoute }] });
    };
    assert.deepEqual(await fetchDrivingRoutes(batch), [{ route: freshRoute }]);
    for (const results of [[], [{ route: { ...freshRoute, destination: origin } }], [{ route }], [{ route: { ...freshRoute, roadDistanceMeters: null } }]]) {
      globalThis.fetch = async () => Response.json({ results });
      await assert.rejects(fetchDrivingRoutes(batch));
    }
    globalThis.fetch = async () => Response.json({ error: { code: 'EXTERNAL_RATE_LIMITED', message: 'Provider limit reached', retryable: true } }, { status: 429 });
    await assert.rejects(fetchDrivingRoutes(batch), (e) => e.failure.code === 'EXTERNAL_RATE_LIMITED');
  } finally { globalThis.fetch = original; }
});
test('candidate integration routes only top three fresh compatible alternatives and retains geography', () => {
  const standard = 'IEC_62196_T2_COMBO';
  const evidence = (id, lat, status, connector = standard, observedAt = new Date(now).toISOString()) => ({
    station: { location_id: id, name: id, latitude: lat, longitude: origin.lng },
    evses: [{ id: `${id}-evse`, status, connector_standards: [connector], observed_at: observedAt }],
  });
  const target = evidence('target', origin.lat, 'CHARGING');
  const rows = [target, evidence('incompatible', 54.6801, 'AVAILABLE', 'CHADEMO'),
    evidence('stale', 54.6802, 'AVAILABLE', standard, '2026-10-09T00:00:00Z'),
    evidence('a', 54.681, 'AVAILABLE'), evidence('b', 54.682, 'AVAILABLE'),
    evidence('c', 54.683, 'AVAILABLE'), evidence('d', 54.684, 'AVAILABLE')];
  const alternatives = findAlternatives(target, rows, standard, now);
  assert.deepEqual(alternatives.map((a) => a.evidence.station.location_id), ['a', 'b', 'c']);
  const request = routingCandidates(target.station, alternatives);
  assert.deepEqual(request.origin, origin);
  assert.equal(request.destinations.length, 3);
  assert.equal(request.destinations[0].lat, 54.681);
  assert.equal(isRoutingBatchRequest(request), true);
  assert.ok(alternatives[0].distanceKm < route.roadDistanceMeters / 1000);
});
