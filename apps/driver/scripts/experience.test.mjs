import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const routing = url(await compile('../../../packages/routing/index.ts'));
const types = url(await compile('../src/features/map/types.ts'));
const congestion = url((await compile('../src/features/map/congestion.ts'))
  .replace("'./types'", JSON.stringify(types)).replace("'../../../../../packages/routing'", JSON.stringify(routing)));
const { isStationEvidence } = await import(congestion);
const { recommendAlternatives } = await import(url((await compile('../src/features/map/recommendations.ts'))
  .replace("'./congestion'", JSON.stringify(congestion)).replace("'../../../../../packages/routing'", JSON.stringify(routing))));
const captured = JSON.parse(await readFile(new URL('../src/features/experience/recordedCase.json', import.meta.url), 'utf8'));
const rows = captured.recommendations.map((item) => item.evidence);
const outcomes = Object.fromEntries(captured.recommendations.map((item) => [item.evidence.station.location_id, { route: item.route }]));
const at = Date.parse(captured.checkedAt);

test('recorded case contains valid canonical captured evidence and immutable dated route origins', () => {
  assert.equal(captured.kind, 'recorded-historical-evidence');
  assert.ok([captured.selected, ...rows].every(isStationEvidence));
  for (const item of captured.recommendations) {
    assert.deepEqual(item.route.origin, { lat: captured.selected.station.latitude, lng: captured.selected.station.longitude });
    assert.deepEqual(item.route.destination, { lat: item.evidence.station.latitude, lng: item.evidence.station.longitude });
    assert.ok(Date.parse(item.route.calculatedAt) <= at);
    assert.ok(item.evidence.evses.every((evse) => Date.parse(evse.observed_at) < at));
  }
});
test('captured case reproduces verified road ranking and exact compatible counts at its historical clock', () => {
  const result = recommendAlternatives(captured.selected, rows, captured.standard, at, outcomes);
  assert.equal(result.rankingBasis, 'driving-time');
  assert.deepEqual(result.recommendations.map((item) => item.evidence.station.name), ['Rimi Jeruzalė', 'Jeruzalė', 'Baltupių turgus']);
  assert.deepEqual(result.recommendations.map((item) => item.capacity.available), [2, 2, 1]);
  assert.deepEqual(result.recommendations.map((item) => item.route.drivingDurationSeconds), [163, 173, 293]);
  assert.deepEqual(result.recommendations.map((item) => item.route.roadDistanceMeters), [744, 537, 1621]);
});
test('recorded observations cannot supply a current recommendation or a route from another origin', () => {
  const current = recommendAlternatives(captured.selected, rows, captured.standard, at + 7200000, outcomes);
  assert.equal(current.selectedCapacity.state, 'stale');
  assert.equal(current.recommendations.length, 0);
  const changedOrigin = recommendAlternatives(captured.selected, rows, captured.standard, at, outcomes, { lat: 54.7, lng: 25.2 });
  assert.ok(changedOrigin.recommendations.every((item) => item.route === null));
  assert.equal(changedOrigin.rankingBasis, 'geographic-proximity');
});
