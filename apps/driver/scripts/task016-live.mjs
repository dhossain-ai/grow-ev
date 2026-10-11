import { readFile, writeFile } from 'node:fs/promises';
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^(EXPO_PUBLIC_[A-Z_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (url !== 'https://heafsrqaytsfthfcxmqu.supabase.co' || !key) throw Error('Expected DEV public configuration');
const request = async (path, body, origin) => {
  const r = await fetch(url + path, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  return { status: r.status, cors: r.headers.get('access-control-allow-origin'), body: await r.json() };
};
const map = await request('/rest/v1/rpc/get_map_stations', { min_lng: 25.2, min_lat: 54.68, max_lng: 25.3, max_lat: 54.75, connector_standards: ['IEC_62196_T2_COMBO'] });
if (map.status !== 200 || !map.body.length) throw Error('Real stations unavailable');
const anchor = map.body.find(s => s.name?.includes('Norfa')) ?? map.body[0];
const capacity = await request('/rest/v1/rpc/get_station_capacity', { target_location_id: anchor.location_id });
const prediction = await request('/rest/v1/rpc/get_charging_prediction', { target_location_id: anchor.location_id, target_connector_standard: 'IEC_62196_T2_COMBO' });
const destination = map.body.find(s => s.location_id !== anchor.location_id && Math.abs(s.latitude-anchor.latitude)<.03 && Math.abs(s.longitude-anchor.longitude)<.03);
const routeRequest = { origin: { lat: anchor.latitude, lng: anchor.longitude }, destinations: [{ lat: destination.latitude, lng: destination.longitude }] };
// Provider use is opt-in; the default verifies only public data reads.
const route = process.argv.includes('--route') ? await request('/functions/v1/routing', routeRequest, 'http://localhost:8167') : undefined;
const privateResponse = await fetch(`${url}/rest/v1/charging_predictions?select=*&limit=1`, {
  headers: { apikey: key }, signal: AbortSignal.timeout(20000),
});
const evidence = { checkedAt: new Date().toISOString(), anchor, destination, capacityStatus: capacity.status,
  capacityStationFields: Object.keys(capacity.body[0]?.station ?? {}), capacityEvseFields: Object.keys(capacity.body[0]?.evses?.[0] ?? {}), prediction,
  privatePredictionReadStatus: privateResponse.status, ...(route ? { routeRequest, route } : {}) };
const filename = `integration-public-read-${Date.now()}.json`;
await writeFile(new URL(`../../../artifacts/task-016/${filename}`, import.meta.url), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence));
