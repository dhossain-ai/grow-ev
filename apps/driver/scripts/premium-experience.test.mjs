import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Synthetic evidence and controlled platform boundaries; never live-device proof.
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const compile = async (path, replacements = {}) => {
  let source = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    source = source.replaceAll(`'${specifier}'`, JSON.stringify(replacement)).replaceAll(`"${specifier}"`, JSON.stringify(replacement));
  }
  return dataUrl(source);
};
const routing = await compile('../../../packages/routing/index.ts');
const types = await compile('../src/features/map/types.ts');
const congestion = await compile('../src/features/map/congestion.ts', { './types': types, '../../../../../packages/routing': routing });
const presentationUrl = await compile('../src/features/experience/presentation.ts', {
  '../map/congestion': congestion, '../map/types': types, '../../../../../packages/routing': routing,
});
const { compatiblePower, compatibleObservation, navigationUrls, searchAnchor } = await import(presentationUrl);
const ccs = 'IEC_62196_T2_COMBO', ac = 'IEC_62196_T2';
const now = Date.parse('2026-10-11T08:00:00Z');
test('actual Whisper Type 2 charges wording executes only an unambiguous connector search', async () => {
  const { parseCommand } = await import(await compile('../src/features/voice/commands.ts'));
  assert.deepEqual(parseCommand('Show type 2 charges.'), { kind: 'connector', standard: ac });
  assert.equal(parseCommand('So type to Chargers.'), null);
  assert.equal(parseCommand('Do not show type 2 charges.'), null);
  assert.equal(parseCommand('Show type 2 charges and CCS2 chargers.'), null);
});
const station = (id = 'a', standards = [ccs]) => ({ location_id: id, name: `Synthetic ${id}`, operator_name: 'Fixture operator',
  address: 'Fixture street', city: 'Fixture city', latitude: 54.7, longitude: 25.25, connector_types: standards,
  max_power_kw: 150, total_evse_count: 2, available_evse_count: 1, charging_evse_count: 1,
  unavailable_evse_count: 0, unknown_evse_count: 0, last_observed_at: new Date(now).toISOString() });
const evse = (id, status, connector = ccs, observed = now) => ({ id, status, connector_standards: [connector], observed_at: new Date(observed).toISOString() });
const row = { station: station(), evses: [evse('a1', 'AVAILABLE'), evse('a2', 'CHARGING')] };

test('power is connector-specific only for an unambiguous single-standard station', () => {
  assert.equal(compatiblePower(station(), ccs), 150);
  assert.equal(compatiblePower(station('a', [ccs, ac]), ccs), null);
  assert.equal(compatiblePower(station(), ac), null);
  assert.equal(compatiblePower({ ...station(), max_power_kw: null }, ccs), null);
  assert.equal(searchAnchor([station('mixed', [ccs, ac]), station('single')], ccs, { lat: 54.7, lng: 25.25 }, 50).location_id, 'single');
});
test('canonical EVSE counting preserves compatible status categories and stale/invalid observations', () => {
  const statuses = ['AVAILABLE', 'CHARGING', 'RESERVED', 'BLOCKED', 'OUTOFORDER', 'INOPERATIVE', 'UNKNOWN'];
  const evses = statuses.map((status, i) => evse(String(i), status));
  const observation = compatibleObservation({ station: station(), evses: [...evses, evses[0], evse('ac', 'AVAILABLE', ac)] }, ccs, now);
  assert.equal(observation.compatible, 7);
  for (const status of statuses) assert.equal(observation.breakdown[status], 1);
  for (const observed_at of [new Date(now - 3600001).toISOString(), new Date(now + 1).toISOString(), 'invalid']) {
    assert.equal(compatibleObservation({ ...row, evses: [{ ...row.evses[0], observed_at }] }, ccs, now).label, 'Current availability unverified');
  }
});
test('navigation uses validated destination coordinates on web, iOS and Android', () => {
  assert.match(navigationUrls(station(), 'web')[0], /destination=54.7,25.25/);
  assert.match(navigationUrls(station(), 'ios')[0], /maps.apple.com.*daddr=54.7,25.25/);
  assert.match(navigationUrls(station(), 'android')[0], /google.navigation:q=54.7,25.25/);
  assert.throws(() => navigationUrls({ ...station(), latitude: NaN }, 'web'), /coordinates unavailable/);
});
const statesUrl = await compile('../src/features/voice/states.ts');
const { microphoneFailure } = await import(statesUrl);
const { executeVoiceCommand } = await import(await compile('../src/features/voice/actions.ts', { '../map/types': types }));
const { parseCommand } = await import(await compile('../src/features/voice/commands.ts'));
test('voice changes connector and waits for the actual search before reporting success', async () => {
  const calls = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const actions = { standard: ac, locate: async () => null, selectConnector: (value) => calls.push(value),
    search: async (options) => { calls.push(options); return pending; }, alternatives: async () => false };
  let settled = false;
  const result = executeVoiceCommand(parseCommand('Find CCS2 chargers'), new AbortController().signal, actions).then((value) => { settled = true; return value; });
  await Promise.resolve(); assert.equal(settled, false); assert.equal(calls[0], ccs);
  assert.equal(calls[1].connector, ccs); release(true);
  assert.deepEqual(await result, { ok: true, message: 'Showing CCS2 charging options' });
});
test('voice denied location, canceled requests, failed searches and unknown commands fail safely', async () => {
  let selections = 0, searches = 0;
  const actions = { standard: ac, locate: async () => null, selectConnector: () => selections++, search: async () => { searches++; return false; }, alternatives: async () => false };
  const signal = new AbortController().signal;
  assert.equal((await executeVoiceCommand(parseCommand('Show chargers near me'), signal, actions)).ok, false);
  assert.equal(selections, 0); assert.equal(searches, 0);
  const controller = new AbortController(); controller.abort();
  assert.equal((await executeVoiceCommand(parseCommand('Find Type 2 chargers'), controller.signal, actions)).ok, false);
  assert.equal(selections, 0);
  assert.equal((await executeVoiceCommand(parseCommand('Find Type 2 chargers'), signal, actions)).ok, false);
  assert.equal(parseCommand('Find CCS2 and Type 2 chargers'), null);
  assert.equal(microphoneFailure(Object.assign(new Error('Denied'), { name: 'NotAllowedError' })), 'permission_denied');
  assert.equal(microphoneFailure(new Error('Device unavailable')), 'error');
});
test('near-me voice obtains explicit coordinates before connector selection and search', async () => {
  const origin = { lat: 54.8, lng: 25.3 }; let received;
  const result = await executeVoiceCommand(parseCommand('Find CCS2 chargers near me'), new AbortController().signal, {
    standard: ac, locate: async () => origin, selectConnector: () => {}, search: async (options) => { received = options; return true; }, alternatives: async () => false,
  });
  assert.equal(result.ok, true); assert.deepEqual(received.origin, origin); assert.equal(received.connector, ccs);
});

// Render the actual shared cards, detail disclosures and panel with controlled
// hooks. Event callbacks below exercise state transitions, not screenshot tests.
globalThis.premiumFixture = { native: createRequire(import.meta.url)('react-native-web'), state: [], refs: [], index: 0, refIndex: 0 };
const hooks = dataUrl(`
export const useEffect = () => {};
export const useCallback = (fn) => fn;
export const useRef = (initial) => { const f=globalThis.premiumFixture; const i=f.refIndex++; return f.refs[i]??=( {current:initial} ); };
export const useState = (initial) => { const f=globalThis.premiumFixture; const i=f.index++; if(!(i in f.state))f.state[i]=typeof initial==='function'?initial():initial; return [f.state[i],(value)=>{f.state[i]=typeof value==='function'?value(f.state[i]):value;}]; };
`);
const native = dataUrl('export const { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } = globalThis.premiumFixture.native; export const useWindowDimensions=()=>({width:390,height:844});');
const tokens = await compile('../src/features/map/tokens.ts');
const common = { 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), react: hooks, 'react-native': native, '../map/tokens': tokens };
const ui = dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};
export const CardReveal=({children})=>React.createElement('div',null,children);
export const ActionButton=({label,onPress})=>React.createElement('button',{onClick:onPress},label);
export const ConnectorSelector=({value,onChange})=>React.createElement('button',{onClick:()=>onChange('IEC_62196_T2'), 'aria-label':'Use Type 2', 'aria-pressed':value==='IEC_62196_T2'},'Type 2');`);
const icons = await compile('../src/components/DriverIcons.tsx', { ...common, '../features/map/tokens': tokens });
const cardDeps = { ...common, '../../components/CalmUI': ui, '../../components/DriverIcons': icons, '../map/types': types, './presentation': presentationUrl };
const cardUrl = await compile('../src/features/experience/PremiumStationCard.tsx', cardDeps);
const { PremiumStationCard } = await import(cardUrl);
const detailsUrl = await compile('../src/features/experience/PremiumStationDetails.tsx', { ...cardDeps, 'expo-clipboard': dataUrl('export const setStringAsync=async()=>true;') });
const { PremiumStationDetails } = await import(detailsUrl);
const render = (element) => renderToStaticMarkup(element);
const reset = (state = []) => { Object.assign(globalThis.premiumFixture, { state, refs: [], index: 0, refIndex: 0 }); };
const rerender = () => { globalThis.premiumFixture.index = 0; globalThis.premiumFixture.refIndex = 0; };
const nodes = (element) => {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
};
test('recommendation card shows real equipment, freshness and route absence without an invented AI outlook', () => {
  reset();
  const html = render(React.createElement(PremiumStationCard, { evidence: row, standard: ccs, now, featured: true, onDetails() {}, onDirections() {} }));
  for (const text of ['Synthetic a', '150 kW', '2 last seen', 'Get directions']) {
    // Only one of the two compatible points is AVAILABLE.
    if (text === '2 last seen') assert.doesNotMatch(html, /2 last seen available/); else assert.ok(html.includes(text));
  }
  assert.match(html, /1 last seen available/); assert.match(html, /Driving time unavailable/);
  assert.doesNotMatch(html, /AI outlook|Top match/);
});
test('station disclosure opens and closes, preserving each compatible status and copy action', () => {
  reset(); const props = { evidence: row, standard: ccs, now, onDirections() {}, onCompare() {} };
  let tree = PremiumStationDetails(props);
  assert.doesNotMatch(render(tree), /COMPATIBLE CHARGING POINT STATUS/);
  nodes(tree).find((node) => node.props.accessibilityState?.expanded === false).props.onPress(); rerender();
  tree = PremiumStationDetails(props); const html = render(tree);
  for (const text of ['AVAILABLE', 'CHARGING', 'RESERVED', 'BLOCKED', 'OUT OF ORDER', 'INOPERATIVE', 'UNKNOWN', 'Copy address', 'Fixture street']) assert.ok(html.includes(text));
  nodes(tree).find((node) => node.props.accessibilityState?.expanded === true).props.onPress(); rerender();
  assert.doesNotMatch(render(PremiumStationDetails(props)), /COMPATIBLE CHARGING POINT STATUS/);
});
const searchStub = dataUrl('export const useDriverSearch=()=>globalThis.premiumFixture.search;');
const voiceStub = dataUrl('export const VoiceControl=()=>null;');
const actionsUrl = await compile('../src/features/voice/actions.ts', { '../map/types': types });
const { ExperiencePanel } = await import(await compile('../src/features/experience/ExperiencePanel.tsx', {
  ...cardDeps, './PremiumStationCard': cardUrl, './PremiumStationDetails': detailsUrl, './useDriverSearch': searchStub,
  '../voice/VoiceControl': voiceStub, '../voice/actions': actionsUrl,
}));
const searchState = (phase, rows = []) => ({ phase, rows, options: rows, routeFor: () => null, result: null, anchor: rows[0], now, error: phase === 'error' ? 'Fixture read failed' : null,
  search: async () => true, reset() {}, retryAt: 0, routing: false, compareDriving() {} });
const panelProps = { selected: null, standard: ccs, onStandardChange() {}, onClose() {}, onHighlight() {}, onPresentationChange() {}, bounds: null,
  onFiltersChange() {}, onLocate: async () => null, onWiden() {}, filterRequest: 0 };
test('home connector selection updates map filters and manual search opens results', async () => {
  reset(); globalThis.premiumFixture.search = searchState('idle'); let chosen, filters;
  const props = { ...panelProps, onStandardChange: (value) => chosen = value, onFiltersChange: (value) => filters = value };
  let tree = ExperiencePanel(props);
  nodes(tree).find((node) => node.type.name === 'ConnectorSelector').props.onChange(ac);
  assert.equal(chosen, ac); assert.deepEqual(filters, { connectorStandards: [ac] });
  rerender(); tree = ExperiencePanel({ ...props, standard: ac });
  nodes(tree).find((node) => node.props.label === 'Find charging options  →').props.onPress();
  assert.equal(globalThis.premiumFixture.state[0], 'results');
});
test('panel loading, empty and read-error states preserve connector and useful recovery', () => {
  for (const [phase, heading, recovery] of [['loading', 'Finding your charging options', 'Checking compatible'], ['empty', 'No matching chargers nearby', 'Search a wider area'], ['error', 'Charging data unavailable', 'Try again']]) {
    reset(['results', null, false, false, null]); globalThis.premiumFixture.search = searchState(phase);
    const html = render(ExperiencePanel(panelProps));
    for (const text of [heading, recovery, 'CCS2']) assert.ok(html.includes(text));
  }
});
test('comparison selection opens correct details and close returns home', () => {
  const other = { ...row, station: station('b') };
  reset(['compare', null, false, false, null]); globalThis.premiumFixture.search = searchState('ready', [row, other]); let highlighted;
  const props = { ...panelProps, onHighlight: (value) => highlighted = value };
  const tree = ExperiencePanel(props);
  nodes(tree).find((node) => node.type === PremiumStationCard && node.props.evidence.station.location_id === 'b').props.onDetails();
  assert.equal(highlighted.location_id, 'b'); assert.equal(globalThis.premiumFixture.state[0], 'details');
  rerender(); const details = ExperiencePanel(props);
  assert.ok(nodes(details).some((node) => node.type === PremiumStationDetails && node.props.evidence.station.location_id === 'b'));
  nodes(details).find((node) => node.props.accessibilityLabel === 'Close charging results').props.onPress();
  assert.equal(globalThis.premiumFixture.state[0], 'home');
});

const recommendationsUrl = await compile('../src/features/map/recommendations.ts', { './congestion': congestion, '../../../../../packages/routing': routing });
const fakeReads = dataUrl(`export const fetchMapStations=(...args)=>globalThis.premiumFixture.mapRead(...args); export const fetchStationCapacity=(...args)=>globalThis.premiumFixture.capacityRead(...args);`);
const fakeRoutes = dataUrl(`export class RoutingClientError extends Error {} export const fetchDrivingRoutes=(...args)=>globalThis.premiumFixture.routeRead(...args);`);
const { useDriverSearch } = await import(await compile('../src/features/experience/useDriverSearch.ts', {
  react: hooks, 'react-native': native, '../map/api': fakeReads, '../map/capacityApi': fakeReads, '../map/congestion': congestion,
  '../map/recommendations': recommendationsUrl, '../map/routingApi': fakeRoutes, './presentation': presentationUrl,
}));
test('real search hook keeps power-ineligible alternatives out and routes from explicit near-me origin', async () => {
  reset(); const at = Date.now(), origin = { lat: 54.7, lng: 25.24 };
  const anchor = { station: station('anchor'), evses: [evse('anchor1', 'CHARGING', ccs, at)] };
  const lowPower = { station: { ...station('low'), latitude: 54.7001, max_power_kw: 22 }, evses: [evse('low1', 'AVAILABLE', ccs, at)] };
  const suitable = { station: { ...station('suitable'), latitude: 54.7002 }, evses: [evse('suitable1', 'AVAILABLE', ccs, at)] };
  const f = globalThis.premiumFixture; let routeRequest;
  f.mapRead = async () => [anchor.station]; f.capacityRead = async () => [anchor, lowPower, suitable];
  f.routeRead = async (request) => { routeRequest = request; return [{ error: { code: 'UNAVAILABLE', message: 'Fixture route unavailable' } }]; };
  let search = useDriverSearch(ccs, null);
  assert.equal(await search.search({ connector: ccs, minPowerKw: 50, origin }), true);
  rerender(); search = useDriverSearch(ccs, null);
  assert.deepEqual(search.rows.map((item) => item.station.location_id), ['anchor', 'suitable']);
  assert.deepEqual(search.result.recommendations.map((item) => item.evidence.station.location_id), ['suitable']);
  assert.equal(search.result.originKind, 'user-origin'); await search.compareDriving();
  assert.deepEqual(routeRequest.origin, origin); assert.equal(routeRequest.destinations.length, 1);
});
test('reset invalidates delayed charging evidence instead of reopening canceled results', async () => {
  reset(); const f = globalThis.premiumFixture; let release;
  f.capacityRead = () => new Promise((resolve) => { release = resolve; });
  let search = useDriverSearch(ccs, null);
  const pending = search.search({ station: station() }); await Promise.resolve(); search.reset();
  release([row]); assert.equal(await pending, false); rerender(); search = useDriverSearch(ccs, null);
  assert.equal(search.phase, 'idle'); assert.deepEqual(search.rows, []);
});
test('empty canonical compatible evidence does not report successful voice/manual search', async () => {
  reset(); const f = globalThis.premiumFixture;
  f.capacityRead = async () => [{ station: station(), evses: [evse('only-ac', 'AVAILABLE', ac, Date.now())] }];
  let search = useDriverSearch(ccs, null);
  assert.equal(await search.search({ station: station() }), false); rerender(); search = useDriverSearch(ccs, null);
  assert.equal(search.phase, 'empty'); assert.deepEqual(search.rows, []);
});
const { VoiceControl } = await import(await compile('../src/features/voice/VoiceControl.tsx', {
  ...cardDeps, './commands': await compile('../src/features/voice/commands.ts'), './states': statesUrl,
  './api': dataUrl('export const transcribe=async()=>"Find CCS2 chargers";'),
  './useRecording': dataUrl('export const useRecording=()=>globalThis.premiumFixture.recording;'),
}));
test('actual voice UI renders processing, misunderstood and denied states with manual recovery', () => {
  globalThis.premiumFixture.recording = { start() {}, finish() {}, cancel() {} };
  for (const [phase, heading, recovery] of [['processing', 'Understanding', 'Cancel voice'], ['unrecognized', 'Didn’t catch that', 'Search manually'], ['permission_denied', 'Microphone access', 'Continue without voice']]) {
    reset([phase, 'Fixture message']);
    const html = render(VoiceControl({ onCommand: async () => ({ ok: false, message: 'Fixture' }) }));
    assert.ok(html.includes(heading)); assert.ok(html.includes(recovery)); assert.doesNotMatch(html, /Find CCS2 chargers<\/div>/);
  }
});
test('microphone denial cannot display Listening or invoke charging search', async () => {
  reset(); let calls = 0;
  globalThis.premiumFixture.recording = { start: async () => { throw new Error('Microphone permission denied'); }, cancel: async () => {} };
  const props = { onCommand: async () => { calls++; return { ok: true, message: 'Incorrect success' }; } };
  const tree = VoiceControl(props);
  tree.props.onPress(); await Promise.resolve(); await Promise.resolve(); rerender();
  const html = render(VoiceControl(props)); assert.match(html, /Microphone access/); assert.doesNotMatch(html, /Listening/); assert.equal(calls, 0);
});

test('uncongested search sends bounded real routes and displays them without inventing a ranking', async () => {
  reset(); const at = Date.now(), origin = { lat: 54.7, lng: 25.24 }, f = globalThis.premiumFixture;
  const rows = Array.from({ length: 5 }, (_, i) => ({ station: { ...station(String(i)), latitude: 54.7+i*.001 },
    evses: [evse(String(i), 'AVAILABLE', ccs, at)] }));
  f.capacityRead = async () => rows; f.routeRead = async request => {
    assert.equal(request.destinations.length, 3); assert.deepEqual(request.origin, origin);
    return request.destinations.map(destination => ({ route: { origin, destination, drivingDurationSeconds: 438,
      roadDistanceMeters: 4924, trafficAware: true, provider: 'tomtom', calculatedAt: new Date().toISOString() } }));
  };
  let search = useDriverSearch(ccs, null); await search.search({ station: rows[0].station });
  rerender(); search = useDriverSearch(ccs, null); assert.equal(search.result.recommendations.length, 0);
  await search.compareDriving(origin); rerender(); search = useDriverSearch(ccs, null);
  const route = search.routeFor(rows[0].station); assert.equal(route.drivingDurationSeconds, 438);
  const html = render(React.createElement(PremiumStationCard, { evidence: rows[0], standard: ccs, now: at, route,
    originKind: 'user-origin', onDetails() {}, onDirections() {} }));
  assert.match(html, /8 min drive/); assert.match(html, /requested location/); assert.doesNotMatch(html, /Top match/);
});
