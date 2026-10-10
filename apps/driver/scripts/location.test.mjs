import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const compile = async (name) => ts.transpileModule(await readFile(new URL(`../src/features/location/${name}.ts`, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const positionUrl = url(await compile('position'));
const { positionFromFix, locationError } = await import(positionUrl);
const now = 1800000000000;
// Deliberately synthetic fixes; not live measurements.
const coords = { latitude: 54.7, longitude: 25.3, accuracy: 12 };
test('accepts a valid fix unchanged and rejects stale, future and invalid positions', () => {
  assert.deepEqual(positionFromFix(coords, now, now), { lat: 54.7, lng: 25.3, accuracy: 12, timestamp: now });
  for (const patch of [{ latitude: NaN }, { latitude: 91 }, { longitude: 181 }, { accuracy: -1 }, { accuracy: null }]) {
    assert.throws(() => positionFromFix({ ...coords, ...patch }, now, now));
  }
  for (const timestamp of [NaN, now + 1, now - 120001]) assert.throws(() => positionFromFix(coords, timestamp, now));
});
test('web requests one fresh explicit fix and reports denied, unavailable, timeout and insecure context', async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const { requestPosition } = await import(url((await compile('requestPosition.web')).replace("'./position'", JSON.stringify(positionUrl))));
  let calls = 0;
  try {
    globalThis.window = { isSecureContext: true };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
      getCurrentPosition: (success, failure, options) => {
        calls++; assert.equal(options.maximumAge, 0); assert.equal(options.timeout, 15000);
        success({ coords, timestamp: Date.now() });
      },
    } } });
    assert.equal(calls, 0);
    assert.equal((await requestPosition()).lng, 25.3); assert.equal(calls, 1);
    for (const code of [1, 2, 3]) {
      navigator.geolocation.getCurrentPosition = (_, failure) => failure({ code });
      await assert.rejects(requestPosition(), { message: locationError(code) });
    }
    window.isSecureContext = false;
    await assert.rejects(requestPosition(), /HTTPS or localhost/);
    window.isSecureContext = true;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    await assert.rejects(requestPosition(), /does not support/);
  } finally {
    globalThis.window = originalWindow;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('native uses foreground permission only and fails closed on denial and disabled services', async () => {
  const calls = [];
  globalThis.nativeLocationFixture = {
    requestForegroundPermissionsAsync: async () => { calls.push('permission'); return { granted: true }; },
    hasServicesEnabledAsync: async () => { calls.push('services'); return true; },
    getCurrentPositionAsync: async (options) => {
      assert.equal(options.mayShowUserSettingsDialog, false);
      calls.push('fix'); return { coords, timestamp: Date.now() };
    },
    Accuracy: { High: 4 },
  };
  const fixtureModule = url(`
export const requestForegroundPermissionsAsync = (...args) => globalThis.nativeLocationFixture.requestForegroundPermissionsAsync(...args);
export const hasServicesEnabledAsync = (...args) => globalThis.nativeLocationFixture.hasServicesEnabledAsync(...args);
export const getCurrentPositionAsync = (...args) => globalThis.nativeLocationFixture.getCurrentPositionAsync(...args);
export const Accuracy = globalThis.nativeLocationFixture.Accuracy;
`);
  const { requestPosition } = await import(url((await compile('requestPosition'))
    .replace("'expo-location'", JSON.stringify(fixtureModule)).replace("'./position'", JSON.stringify(positionUrl))));
  try {
    assert.equal(calls.length, 0);
    assert.equal((await requestPosition()).lat, 54.7);
    assert.deepEqual(calls, ['permission', 'services', 'fix']);
    calls.length = 0;
    nativeLocationFixture.requestForegroundPermissionsAsync = async () => { calls.push('permission'); return { granted: false }; };
    await assert.rejects(requestPosition(), { message: locationError(1) });
    assert.deepEqual(calls, ['permission']);
    nativeLocationFixture.requestForegroundPermissionsAsync = async () => ({ granted: true });
    nativeLocationFixture.hasServicesEnabledAsync = async () => false;
    await assert.rejects(requestPosition(), { message: locationError(2) });
    nativeLocationFixture.hasServicesEnabledAsync = async () => true;
    nativeLocationFixture.getCurrentPositionAsync = async () => { throw new Error('native detail'); };
    await assert.rejects(requestPosition(), { message: locationError(2) });
  } finally { delete globalThis.nativeLocationFixture; }
});


test('foreground hook survives permission-dialog backgrounding and rejects fixes while backgrounded', async () => {
  const reactModule = url(`export const useState = (...args) => globalThis.locationHookFixture.useState(...args);
export const useRef = (...args) => globalThis.locationHookFixture.useRef(...args);
export const useEffect = (...args) => globalThis.locationHookFixture.useEffect(...args);`);
  const nativeModule = url(`export const AppState = {
get currentState() { return globalThis.locationHookFixture.currentState; },
addEventListener: (_, callback) => { globalThis.locationHookFixture.listener = callback; return { remove() {} }; }
};`);
  const requestModule = url(`export const requestPosition = () => globalThis.locationHookFixture.request();`);
  const { useUserLocation } = await import(url((await compile('useUserLocation'))
    .replace("'react'", JSON.stringify(reactModule)).replace("'react-native'", JSON.stringify(nativeModule))
    .replace("'./position'", JSON.stringify(positionUrl)).replace("'./requestPosition'", JSON.stringify(requestModule))));
  const fix = { lat: 54.7, lng: 25.3, accuracy: 12, timestamp: Date.now() };
  try {
    for (const scenario of ['allowed', 'denied', 'background']) {
      const states = []; const effects = []; let resolveFix; let rejectFix; let calls = 0;
      globalThis.locationHookFixture = {
        currentState: 'active',
        useState: (initial) => { const index = states.push(initial) - 1; return [initial, (value) => { states[index] = value; }]; },
        useRef: (initial) => ({ current: initial }), useEffect: (effect) => effects.push(effect),
        request: () => { calls++; return new Promise((resolve, reject) => { resolveFix = resolve; rejectFix = reject; }); },
      };
      const hook = useUserLocation(); const cleanups = effects.map((effect) => effect());
      assert.equal(calls, 0);
      const pending = hook.locate(); assert.equal(await hook.locate(), null); assert.equal(calls, 1);
      locationHookFixture.currentState = 'background'; locationHookFixture.listener('background');
      if (scenario !== 'background') { locationHookFixture.currentState = 'active'; locationHookFixture.listener('active'); }
      if (scenario === 'denied') rejectFix(new Error(locationError(1))); else resolveFix(fix);
      const result = await pending;
      assert.equal(states[1], false);
      if (scenario === 'allowed') {
        assert.deepEqual(result, fix); assert.deepEqual(states[0], fix);
        locationHookFixture.currentState = 'background'; locationHookFixture.listener('background'); assert.equal(states[0], null);
      } else {
        assert.equal(result, null); assert.equal(states[0], null);
        assert.equal(states[2], scenario === 'denied' ? locationError(1) : null);
      }
      cleanups.forEach((cleanup) => cleanup?.());
    }
  } finally { delete globalThis.locationHookFixture; }
});
