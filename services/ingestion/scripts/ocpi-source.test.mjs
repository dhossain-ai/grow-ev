import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fetchSnapshot, parseLocations } from './ocpi-source.ts';

const fixture = JSON.parse(await readFile(new URL('../fixtures/ocpi-locations.sample.json', import.meta.url), 'utf8'));
const time = '2026-10-10T10:00:00Z';
const evidence = () => ({ pages: [], duplicates: 0, advertisedTotal: null, verified: false });
test('fixture identities, EVSE capacity and raw offset-free timestamps', () => {
  const s = parseLocations(fixture, time);
  assert.equal(s.locations[0].ocpi_location_id, '258');
  assert.equal(s.evses[0].uid, '535');
  assert.equal(s.evses[0].source_last_updated_at, null);
  assert.equal(s.evses[0].source_last_updated_text, '2026-10-09T17:21:50');
  const multi = structuredClone(fixture);
  multi.data[0].evses[0].connectors.push({ ...multi.data[0].evses[0].connectors[0], id: 650307 });
  const result = parseLocations(multi, time);
  assert.equal(result.evses.length, 1);
  assert.equal(result.connectors.length, 2);
});
test('missing and future statuses remain UNKNOWN with original evidence', () => {
  for (const status of [undefined, 'FUTURE_STATE', 'unknown', '']) {
    const f = structuredClone(fixture); f.data[0].evses[0].status = status;
    const s = parseLocations(f, time);
    assert.equal(s.evses[0].current_status, 'UNKNOWN');
    assert.equal(s.evses[0].source_status, status ?? null);
  }
});
test('invalid nested records, numbers and canonical identities fail validation', () => {
  for (const mutate of [f => f.data[0].evses.push(null), f => f.data[0].id = Number.MAX_SAFE_INTEGER + 1, f => f.data[0].evses[0].connectors[0].voltage = -1, f => f.data[0].coordinates.latitude = '100', f => delete f.data[0].evses]) {
    const f = structuredClone(fixture); mutate(f);
    assert.throws(() => parseLocations(f, time));
  }
});
function mock(mode) {
  return async url => {
    const u = new URL(url), offset = Number(u.searchParams.get('offset')), limit = Number(u.searchParams.get('limit'));
    const first = structuredClone(fixture.data[0]), second = structuredClone(first);
    second.id = 259; second.evses[0].uid = 536;
    const all = [first, second];
    let data = limit === 100000 ? all : offset === 0 ? [first] : offset === 2000 ? [second] : [];
    if (mode === 'duplicate' && offset === 1000) data = [first];
    if (mode === 'conflict' && offset === 1000) { data = [structuredClone(first)]; data[0].name = 'different'; }
    if (mode === 'partial' && limit === 100000) data = [first];
    const headers = { 'x-total-count': mode === 'changed' && offset > 0 ? '3002' : '3001', link: '</broken??limit=1000>; rel="next"' };
    if (mode === 'missing') delete headers['x-total-count'];
    return new Response(JSON.stringify({ timestamp: time, status_code: 1000, data }), { headers });
  };
}
test('short/empty windows and malformed links: cross-checked identities prove accessible traversal', async () => {
  const e = evidence(), s = await fetchSnapshot(e, mock('normal'), async () => {});
  assert.equal(s.locations.length, 2); assert.equal(e.verified, true);
  assert.deepEqual(e.pages.filter(p => p.limit === 1000).map(p => p.offset), [0, 1000, 2000, 3000, 4000]);
});
test('identical duplicates deduplicate; conflicting duplicates fail closed', async () => {
  const e = evidence(), s = await fetchSnapshot(e, mock('duplicate'), async () => {});
  assert.equal(s.evses.length, 2); assert.equal(e.duplicates, 3);
  await assert.rejects(fetchSnapshot(evidence(), mock('conflict'), async () => {}), /Conflicting duplicate/);
});
for (const mode of ['partial', 'missing', 'changed']) test(`unverified ${mode} fetch cannot be COMPLETE`, async () => {
  const e = evidence(); await assert.rejects(fetchSnapshot(e, mock(mode), async () => {})); assert.equal(e.verified, false);
});
test('bounded retries cover network, truncated JSON and transient HTTP failures', async () => {
  for (const response of [() => { throw new Error('network'); }, () => new Response('{'), () => new Response('', { status: 503 })]) {
    let calls = 0; const e = evidence();
    await assert.rejects(fetchSnapshot(e, async () => { calls++; return response(); }, async () => {}));
    assert.equal(calls, 3); assert.equal(e.verified, false);
  }
  let calls = 0;
  await assert.rejects(fetchSnapshot(evidence(), async () => { calls++; return new Response('', { status: 403 }); }, async () => {}));
  assert.equal(calls, 1);
});
