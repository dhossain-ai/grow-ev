import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = ts.transpileModule(await readFile(new URL('../src/components/useHydratedWindowDimensions.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
globalThis.dimensionFixture = { platform: 'web', dimensions: { width: 1440, height: 900, scale: 1, fontScale: 1 }, state: [], effects: [], index: 0 };
const native = url(`export const Platform={get OS(){return globalThis.dimensionFixture.platform;}};
export const useWindowDimensions=()=>globalThis.dimensionFixture.dimensions;`);
const load = async (react) => import(url(source.replaceAll("'react-native'", JSON.stringify(native)).replaceAll("'react'", JSON.stringify(react))));
const actual = await load(import.meta.resolve('react'));

test('server and initial web hydration have identical layout even when browser dimensions are known', () => {
  const Consumer = () => {
    const dims = actual.useHydratedWindowDimensions();
    return React.createElement('div', { 'data-wide': dims.width >= 900, 'data-narrow': dims.width < 360, 'data-compact': dims.height < 700 });
  };
  const f = globalThis.dimensionFixture;
  f.dimensions = { ...f.dimensions, width: 0, height: 0 };
  const server = renderToStaticMarkup(React.createElement(Consumer));
  for (const width of [1440, 1280, 768, 390, 320]) {
    f.dimensions = { ...f.dimensions, width, height: 900 };
    assert.equal(renderToStaticMarkup(React.createElement(Consumer)), server);
  }
});

const controlled = await load(url(`
export const useSyncExternalStore=(subscribe,client,server)=>globalThis.dimensionFixture.hydrating ? server() : client();
`));
test('web mount applies actual dimensions without resize and continues following breakpoint changes', () => {
  const f = globalThis.dimensionFixture;
  for (const width of [1440, 1280, 768, 390, 320]) {
    Object.assign(f, { platform: 'web', dimensions: { width, height: 844, scale: 1, fontScale: 1 }, state: [], index: 0, effects: [], hydrating: true });
    assert.equal(controlled.useHydratedWindowDimensions().width, 0);
    f.hydrating = false;
    assert.deepEqual(controlled.useHydratedWindowDimensions(), f.dimensions);
    f.dimensions = { ...f.dimensions, width: 390, height: 568 }; f.index = 0;
    assert.deepEqual(controlled.useHydratedWindowDimensions(), f.dimensions);
  }
});
test('native layout uses real dimensions on its first render', () => {
  const f = globalThis.dimensionFixture;
  Object.assign(f, { platform: 'android', dimensions: { width: 411, height: 914, scale: 2.625, fontScale: 1 }, state: [], index: 0, effects: [], hydrating: true });
  assert.deepEqual(controlled.useHydratedWindowDimensions(), f.dimensions);
});
