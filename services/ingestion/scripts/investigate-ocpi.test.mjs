import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./investigate-ocpi.ts', import.meta.url));

function runMock(mode) {
  const preload = `
    globalThis.fetch = async (url) => {
      const offset = Number(new URL(url).searchParams.get('offset') ?? 0);
      const mode = ${JSON.stringify(mode)};
      const id = mode === 'duplicate' ? 1 : offset + 1;
      const total = mode === 'changed-total' && offset > 0 ? 2002 : 2001;
      return new Response(JSON.stringify({
        timestamp: '2026-10-09T00:00:00Z', status_code: 1000,
        data: offset === 1000 && mode === 'empty-middle' ? [] : [
          {country_code:'LT', party_id:'TEST', id, city:' Vilnius ', evses:[]}
        ]
      }), {headers: mode === 'missing-total' ? {} : {'x-total-count': String(total)}});
    };
  `;
  return spawnSync(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(preload)}`, script,
  ], { encoding: 'utf8', timeout: 10_000 });
}

test('advances source windows through an empty middle page', () => {
  const result = runMock('empty-middle');
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.totalLocations, 2);
  assert.equal(summary.vilnius.locations, 2);
  assert.deepEqual(summary.pagination.pages.map((page) => page.offset), [0, 1000, 2000]);
});

for (const [mode, message] of [
  ['duplicate', /Duplicate location across pages/],
  ['changed-total', /changed during pagination/],
  ['missing-total', /Missing or invalid X-Total-Count/],
]) {
  test(`rejects ${mode}`, () => {
    const result = runMock(mode);
    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
  });
}
