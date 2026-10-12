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
const native = dataUrl('export const { ActivityIndicator, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } = globalThis.premiumFixture.native; export const Modal=({visible,children})=>visible?children:null; export const useWindowDimensions=()=>({width:390,height:844});');
const tokens = await compile('../src/features/map/tokens.ts');
const common = { 'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'), react: hooks, 'react-native': native, '../map/tokens': tokens };
const ui = dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};
export const CardReveal=({children})=>React.createElement('div',null,children);
export const ActionButton=({label,onPress})=>React.createElement('button',{onClick:onPress},label);
export const useReducedMotion=()=>true;
export const ConnectorSelector=({value,onChange})=>React.createElement('button',{onClick:()=>onChange('IEC_62196_T2'), 'aria-label':'Use Type 2', 'aria-pressed':value==='IEC_62196_T2'},'Type 2');`);
const icons = await compile('../src/components/DriverIcons.tsx', { ...common, '../features/map/tokens': tokens });
const cardDeps = { '../predictions/PredictionOutlook': dataUrl('export const PredictionOutlook=()=>null;'), ...common, '../../components/CalmUI': ui, '../../components/DriverIcons': icons, '../map/types': types, './presentation': presentationUrl, '../../../../../packages/routing': routing };
const cardUrl = await compile('../src/features/experience/PremiumStationCard.tsx', cardDeps);
const { PremiumStationCard } = await import(cardUrl);
const responsibleUrl = await compile('../src/features/experience/ResponsibleCharging.tsx', { ...cardDeps, 'react-native-safe-area-context': dataUrl('export const useSafeAreaInsets=()=>({bottom:0});') });
const { ResponsibleCharging } = await import(responsibleUrl);
const detailsUrl = await compile('../src/features/experience/PremiumStationDetails.tsx', { ...cardDeps, './ResponsibleCharging': responsibleUrl, 'expo-clipboard': dataUrl('export const setStringAsync=async()=>true;') });
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
  assert.equal(nodes(tree).some((node) => node.type === ResponsibleCharging), false);
  nodes(tree).find((node) => node.props.accessibilityState?.expanded === false).props.onPress(); rerender();
  tree = PremiumStationDetails(props); const html = render(tree);
  assert.equal(nodes(tree).find((node) => node.type === ResponsibleCharging).props.station.location_id, 'a');
  for (const text of ['AVAILABLE', 'CHARGING', 'RESERVED', 'BLOCKED', 'OUT OF ORDER', 'INOPERATIVE', 'UNKNOWN', 'Copy address', 'Fixture street']) assert.ok(html.includes(text));
  nodes(tree).find((node) => node.props.accessibilityState?.expanded === true).props.onPress(); rerender();
  assert.doesNotMatch(render(PremiumStationDetails(props)), /COMPATIBLE CHARGING POINT STATUS/);
});

test('report preview uses the selected station, requires a category, and never submits or persists', () => {
  reset(); const props = { station: station('canonical-selected') };
  let tree = ResponsibleCharging(props);
  nodes(tree).find((node) => node.props.label === 'Report an issue · Preview only').props.onPress(); rerender();
  tree = ResponsibleCharging(props);
  assert.match(render(tree), /PREVIEW ONLY.*Nothing is sent or saved/);
  assert.match(render(tree), /canonical-selected/);
  assert.equal(nodes(tree).filter((node) => node.props.accessibilityRole === 'radio').length, 5);
  const review = nodes(tree).find((node) => node.props.label === 'Review preview');
  assert.equal(review.props.disabled, true); review.props.onPress();
  assert.equal(globalThis.premiumFixture.state[3], false);
  nodes(tree).find((node) => node.props.accessibilityRole === 'radio').props.onPress();
  const input = nodes(tree).find((node) => node.props.accessibilityLabel === 'Optional issue description');
  assert.equal(input.props.maxLength, 240); input.props.onChangeText('Observed access obstruction'); rerender();
  tree = ResponsibleCharging(props);
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  globalThis.fetch = () => { throw new Error('Preview must not send'); };
  globalThis.localStorage = { setItem() { throw new Error('Preview must not persist'); } };
  try {
    nodes(tree).find((node) => node.props.label === 'Review preview').props.onPress(); rerender();
    tree = ResponsibleCharging(props);
    assert.match(render(tree), /Vehicle blocking charging access/);
    assert.match(render(tree), /Observed access obstruction/);
    assert.match(render(tree), /Preview only · Report not submitted/);
    nodes(tree).find((node) => typeof node.props.onRequestClose === 'function').props.onRequestClose(); rerender();
    tree = ResponsibleCharging(props);
    assert.equal(nodes(tree).find((node) => typeof node.props.onRequestClose === 'function').props.visible, false);
    assert.deepEqual(globalThis.premiumFixture.state, [null, null, '', false]);
  } finally { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; }
});

test('Grow Points explains future verified incentives without accounts or invented rewards', () => {
  reset(); let tree = ResponsibleCharging({ station: station() });
  nodes(tree).find((node) => node.props.label === 'Grow Points · Coming soon').props.onPress(); rerender();
  tree = ResponsibleCharging({ station: station() }); const html = render(tree);
  assert.match(html, /Rewards program · Coming soon/);
  assert.match(html, /verified helpful reports and responsible charging/);
  assert.doesNotMatch(html, /balance|Sign in|points earned|Claim reward/i);
  nodes(tree).find((node) => node.props.label === 'Got it').props.onPress();
  assert.equal(globalThis.premiumFixture.state[0], null);
});
const searchStub = dataUrl('export const useDriverSearch=()=>globalThis.premiumFixture.search;');
const voiceStub = dataUrl('export const VoiceControl=()=>null;');
const actionsUrl = await compile('../src/features/voice/actions.ts', { '../map/types': types });
const { ExperiencePanel } = await import(await compile('../src/features/experience/ExperiencePanel.tsx', {
  '../../components/useHydratedWindowDimensions': dataUrl('export const useHydratedWindowDimensions=()=>({width:390,height:844});'),
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

test('driving comparison opens the destination cards even without a congestion recommendation', () => {
  reset(['results', null, false, false, null]);
  const other = { ...row, station: station('destination') };
  let requests = 0;
  globalThis.premiumFixture.search = { ...searchState('ready', [row, other]), compareDriving: () => { requests++; } };
  const tree = ExperiencePanel(panelProps);
  nodes(tree).find(node => node.props.label === 'Compare driving times').props.onPress();
  assert.equal(requests, 1);
  assert.equal(globalThis.premiumFixture.state[0], 'compare');
  rerender();
  assert.ok(nodes(ExperiencePanel(panelProps)).some(node => node.type === PremiumStationCard && node.props.evidence === other));
});

test('ordinary web search opts into routing and Results exposes destination cards with a named origin', async () => {
  reset(); let request;
  globalThis.premiumFixture.search = { ...searchState('idle'), search: async options => { request = options; return true; } };
  nodes(ExperiencePanel(panelProps)).find(node => node.props.label === 'Find charging options  →').props.onPress();
  await Promise.resolve(); assert.equal(request.withDrivingTimes, true);
  const other = { ...row, station: station('destination') };
  globalThis.premiumFixture.search = searchState('ready', [row, other]); rerender();
  const tree = ExperiencePanel(panelProps);
  assert.match(render(tree), /Starting from:.*Demo origin.*Synthetic a/);
  assert.ok(nodes(tree).some(node => node.type === PremiumStationCard && node.props.evidence === other));
});

test('Compare alternatives requests missing routes but reuses valid displayed routes', () => {
  for (const available of [false, true]) {
    reset(['results', null, false, false, null]); let calls = 0;
    globalThis.premiumFixture.search = { ...searchState('ready', [row]), routeFor: () => available ? {} : null, compareDriving: () => calls++ };
    nodes(ExperiencePanel(panelProps)).find(node => node.props.label === 'Compare alternatives').props.onPress();
    assert.equal(calls, available ? 0 : 1); assert.equal(globalThis.premiumFixture.state[0], 'compare');
  }
});

test('route loading never invents minutes and returned route captions name the origin', () => {
  reset(); const props = { evidence: row, standard: ccs, now, originLabel: 'Explicit charger', onDetails() {}, onDirections() {} };
  assert.match(render(React.createElement(PremiumStationCard, { ...props, routing: true })), /Checking driving time/);
  assert.doesNotMatch(render(React.createElement(PremiumStationCard, { ...props, routing: true })), /min drive/);
  assert.match(render(React.createElement(PremiumStationCard, { ...props, route: { drivingDurationSeconds: 217 } })), /4 min drive.*TomTom road estimate.*Explicit charger/);
});

const recommendationsUrl = await compile('../src/features/map/recommendations.ts', { './congestion': congestion, '../../../../../packages/routing': routing });
const fakeReads = dataUrl(`export const fetchMapStations=(...args)=>globalThis.premiumFixture.mapRead(...args); export const fetchStationCapacity=(...args)=>globalThis.premiumFixture.capacityRead(...args);`);
const fakeRoutes = dataUrl(`export class RoutingClientError extends Error {} export const fetchDrivingRoutes=(...args)=>globalThis.premiumFixture.routeRead(...args);`);
const { useDriverSearch } = await import(await compile('../src/features/experience/useDriverSearch.ts', {
  react: hooks, 'react-native': native, '../map/api': fakeReads, '../map/capacityApi': fakeReads, '../map/congestion': congestion,
  '../map/recommendations': recommendationsUrl, '../map/routingApi': fakeRoutes, './presentation': presentationUrl,
}));

test('search routing is opt-in, bounded, skips the charger origin and survives provider failure', async () => {
  for (const withDrivingTimes of [false, true]) {
    reset(); const at = Date.now(), f = globalThis.premiumFixture; let calls = 0;
    const rows = Array.from({ length: 5 }, (_, i) => ({ station: { ...station(String(i)), latitude: 54.7+i*.001 }, evses: [evse(String(i), 'AVAILABLE', ccs, at)] }));
    f.capacityRead = async () => rows;
    f.routeRead = async request => { calls++; assert.ok(request.destinations.length <= 3); assert.ok(request.destinations.every(d => d.lat !== request.origin.lat)); throw new Error('Provider unavailable'); };
    let search = useDriverSearch(ccs, null);
    assert.equal(await search.search({ station: rows[0].station, withDrivingTimes }), true);
    rerender(); search = useDriverSearch(ccs, null);
    assert.equal(calls, withDrivingTimes ? 1 : 0); assert.equal(search.phase, 'ready'); assert.equal(search.routing, false);
    assert.equal(search.routeFor(rows[1].station), null);
    if (withDrivingTimes) assert.equal(search.error, 'Provider unavailable');
  }
});

test('reset rejects delayed search-route responses without reopening Results', async () => {
  reset(); const at = Date.now(), f = globalThis.premiumFixture; let release;
  const other = { station: { ...station('b'), latitude: 54.71 }, evses: [evse('b', 'AVAILABLE', ccs, at)] };
  f.capacityRead = async () => [{ ...row, evses: [evse('a', 'AVAILABLE', ccs, at)] }, other];
  f.routeRead = () => new Promise(resolve => { release = resolve; });
  const search = useDriverSearch(ccs, null);
  const pending = search.search({ station: row.station, withDrivingTimes: true });
  await Promise.resolve(); await Promise.resolve(); search.reset(); release([]);
  assert.equal(await pending, false); rerender(); const after = useDriverSearch(ccs, null);
  assert.equal(after.phase, 'idle'); assert.equal(after.routeFor(other.station), null);
});
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

const predictionUrl = await compile('../src/features/predictions/prediction.ts');
const { parsePrediction, outlookText, MODEL_SHA256, fetchPrediction } = await import(predictionUrl);
const { PredictionOutlook } = await import(await compile('../src/features/predictions/PredictionOutlook.tsx', {
  ...common, '../experience/presentation': presentationUrl, './prediction': predictionUrl,
}));
const predictionId = '20000000-0000-0000-0000-000000000001';
const forecast = { prediction_id: 'a'.repeat(64), location_id: predictionId, connector_standard: ccs,
  source_poll_id: '10000000-0000-0000-0000-000000000001', source_observed_at: new Date(now).toISOString(),
  generated_at: new Date(now).toISOString(), expires_at: new Date(now+3600000).toISOString(),
  horizon: 'next_observation', probability_zero_capacity: .7, model_version: 'availability_v1',
  model_sha256: MODEL_SHA256, experimental: true };
test('forecast validates exact station, connector, poll, model and chronology', () => {
  assert.ok(parsePrediction(forecast, predictionId, ccs, now));
  for (const change of [{ location_id: 'other' }, { connector_standard: ac }, { source_poll_id: 'invalid' },
    { model_version: 'mlp' }, { model_sha256: 'b'.repeat(64) }, { horizon: 'arrival' },
    { generated_at: new Date(now+1).toISOString() }, { expires_at: new Date(now).toISOString() },
    { expires_at: new Date(now+3600001).toISOString() }, { experimental: false },
    { probability_zero_capacity: NaN }, { probability_zero_capacity: -1 }, { probability_zero_capacity: 1.1 }]) {
    assert.equal(parsePrediction({ ...forecast, ...change }, predictionId, ccs, now), null);
  }
});
test('actual forecast view renders only matching fresh observations and rejects missing/expired records', () => {
  const evidence = { ...row, station: station(predictionId) };
  reset([forecast, false]);
  const html = render(PredictionOutlook({ evidence, standard: ccs, now }));
  assert.match(html, /Experimental AI Outlook/); assert.match(html, /Higher model risk/); assert.doesNotMatch(html, /accuracy|70%/);
  assert.match(html, /Source .*Expires/); assert.match(html, /Model availability_v1/);
  for (const props of [{ evidence, standard: ac, now }, { evidence, standard: ccs, now: now+3600000 },
    { evidence: { ...evidence, evses: [evse('old', 'AVAILABLE', ccs, now-1)] }, standard: ccs, now },
    { evidence: { ...evidence, evses: [evse('future', 'AVAILABLE', ccs, now+1)] }, standard: ccs, now }]) {
    reset([forecast, false]); assert.equal(render(PredictionOutlook(props)), '');
  }
  reset([null, false]); assert.equal(render(PredictionOutlook({ evidence, standard: ccs, now })), '');
  reset([null, true]); assert.match(render(PredictionOutlook({ evidence, standard: ccs, now })), /AI outlook unavailable/);
  assert.match(outlookText(.65), /Higher/); assert.match(outlookText(.35), /Lower/); assert.match(outlookText(.5), /Uncertain/);
});
test('public forecast RPC uses only public credentials and distinguishes missing from HTTP or contract errors', async () => {
  const original = globalThis.fetch;
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.invalid'; process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test';
  try {
    globalThis.fetch = async (url, init) => { assert.match(url, /rpc\/get_charging_prediction$/);
      assert.deepEqual(JSON.parse(init.body), { target_location_id: predictionId, target_connector_standard: ccs });
      assert.equal(init.headers.apikey, 'public-test'); assert.equal(init.headers.Authorization, undefined);
      return { ok: true, json: async () => [] }; };
    assert.equal(await fetchPrediction(predictionId, ccs), null);
    for (const data of [{}, [forecast, forecast]]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => data });
      await assert.rejects(fetchPrediction(predictionId, ccs), /Invalid AI/);
    }
    globalThis.fetch = async () => ({ ok: false }); await assert.rejects(fetchPrediction(predictionId, ccs), /unavailable/);
  } finally { globalThis.fetch = original;
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
  }
});
test('review-only power proposal keeps unknown-power positions and does not mutate the shortlist', async () => {
  const { proposedPowerTieBreak } = await import(await compile('../src/features/experience/powerRankingProposal.ts', { './presentation': presentationUrl }));
  const low = { ...row, station: { ...station('low'), max_power_kw: 22 } };
  const high = { ...row, station: { ...station('high'), max_power_kw: 150 } };
  const unknown = { ...row, station: station('unknown', [ccs, ac]) };
  assert.deepEqual(proposedPowerTieBreak([low, unknown, high], ccs).map(row => row.station.location_id), ['high', 'unknown', 'low']);
  assert.deepEqual([low, unknown, high].map(row => row.station.location_id), ['low', 'unknown', 'high']);
});
test('selected-charger and explicit user routes preserve exact origins and reject cross-origin results', async () => {
  const at = Date.now(), anchor = { ...row, station: station('anchor'), evses: [evse('anchor', 'AVAILABLE', ccs, at)] };
  const next = { ...row, station: { ...station('next'), latitude: 54.701 }, evses: [evse('next', 'AVAILABLE', ccs, at)] };
  for (const userOrigin of [undefined, { lat: 54.69, lng: 25.24 }]) {
    reset(); const f = globalThis.premiumFixture;
    const origin = userOrigin ?? { lat: anchor.station.latitude, lng: anchor.station.longitude };
    f.capacityRead = async () => [anchor, next];
    f.routeRead = async request => {
      assert.deepEqual(request.origin, origin);
      return request.destinations.map(destination => ({ route: { origin, destination, drivingDurationSeconds: 120,
        roadDistanceMeters: 600, trafficAware: true, provider: 'tomtom', calculatedAt: new Date().toISOString() } }));
    };
    let search = useDriverSearch(ccs, null); await search.search({ station: anchor.station });
    rerender(); search = useDriverSearch(ccs, null); await search.compareDriving(userOrigin);
    rerender(); search = useDriverSearch(ccs, null);
    assert.deepEqual(search.routeFor(next.station).origin, origin);
    assert.equal(search.result.originKind, userOrigin ? 'user-origin' : 'selected-charger');
    f.routeRead = async request => request.destinations.map(destination => ({ route: { origin: { lat: 54, lng: 25 }, destination,
      drivingDurationSeconds: 120, roadDistanceMeters: 600, trafficAware: true, provider: 'tomtom', calculatedAt: new Date().toISOString() } }));
    await search.compareDriving(userOrigin); rerender(); search = useDriverSearch(ccs, null);
    assert.equal(search.routeFor(next.station), null);
  }
});

test('forecast lifecycle clears at expiry/background and ignores a late canceled RPC', async () => {
  const f = globalThis.premiumFixture;
  const effectHooks = dataUrl(`export { useState } from ${JSON.stringify(hooks)}; export const useEffect=fn=>globalThis.premiumFixture.predictionEffects.push(fn);`);
  const lifecycleNative = dataUrl(`export const {StyleSheet,Text,View}=globalThis.premiumFixture.native;
    export const AppState={addEventListener:(event,fn)=>{globalThis.premiumFixture.predictionBackground=fn;return {remove(){}};}};`);
  const fakePrediction = dataUrl(`export { parsePrediction,outlookText } from ${JSON.stringify(predictionUrl)};
    export const fetchPrediction=(...args)=>globalThis.premiumFixture.predictionRead(...args);`);
  const { PredictionOutlook: LifecycleOutlook } = await import(await compile('../src/features/predictions/PredictionOutlook.tsx', {
    ...common, react: effectHooks, 'react-native': lifecycleNative,
    '../experience/presentation': presentationUrl, './prediction': fakePrediction,
  }));
  const originalSetTimeout=globalThis.setTimeout, originalClearTimeout=globalThis.clearTimeout;
  const timers=[];
  globalThis.setTimeout=(fn,delay)=>{const t={fn,delay};timers.push(t);return t;};
  globalThis.clearTimeout=t=>{if(t)t.cleared=true;};
  let cleanup;
  try {
    const props={evidence:{...row,station:station(predictionId)},standard:ccs,now};
    reset([null,false]); f.predictionEffects=[]; f.predictionRead=async()=>forecast;
    LifecycleOutlook(props); cleanup=f.predictionEffects[0](); await Promise.resolve(); await Promise.resolve();
    rerender(); f.predictionEffects=[]; assert.match(render(LifecycleOutlook(props)),/Experimental AI Outlook/);
    const expiryCleanup=f.predictionEffects[1](); timers.at(-1).fn(); rerender();
    assert.equal(render(LifecycleOutlook(props)), ''); expiryCleanup(); cleanup();
    reset([null,false]); f.predictionEffects=[]; let release;
    f.predictionRead=()=>new Promise(resolve=>release=resolve);
    LifecycleOutlook(props); cleanup=f.predictionEffects[0]();
    f.predictionBackground('background'); release(forecast); await Promise.resolve(); await Promise.resolve();
    rerender(); assert.equal(render(LifecycleOutlook(props)), ''); cleanup();
  } finally {cleanup?.();globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout;}
});

test('premium station card and details show starting point instead of unavailable on origin station', () => {
  reset();
  const originStation = station('origin-station');
  const originRow = { station: originStation, evses: [evse('o1', 'AVAILABLE', ccs, now)] };
  const cardHtml = render(React.createElement(PremiumStationCard, {
    evidence: originRow, standard: ccs, now, featured: true, originKind: 'selected-charger',
    originStationId: 'origin-station', displayOrigin: { lat: originStation.latitude, lng: originStation.longitude },
    onDetails() {}, onDirections() {},
  }));
  assert.match(cardHtml, /Starting point/);
  assert.match(cardHtml, /Driving estimates start from this charger/);
  assert.doesNotMatch(cardHtml, /Driving time unavailable/);

  const detailsHtml = render(React.createElement(PremiumStationDetails, {
    evidence: originRow, standard: ccs, now, originKind: 'selected-charger',
    originStationId: 'origin-station', displayOrigin: { lat: originStation.latitude, lng: originStation.longitude },
    onDirections() {}, onCompare() {},
  }));
  assert.match(detailsHtml, /Starting point/);
  assert.match(detailsHtml, /Driving estimates start from this charger/);
  assert.doesNotMatch(detailsHtml, /Driving time unavailable/);
});

test('results panel displays concise driver-facing language without technical diagnosis or standalone ETA text', () => {
  reset(['results', null, false, false, null]);
  globalThis.premiumFixture.search = { ...searchState('ready', [row]), result: { recommendations: [], rankingBasis: 'geographic-proximity' } };
  const html = render(ExperiencePanel(panelProps));
  assert.match(html, /Compatible charging stations nearby/);
  assert.doesNotMatch(html, /Current observations do not support a ranked alternative/);
  assert.doesNotMatch(html, /Synthetic a · \d+ min drive/);
});
