// Offline sizing of an existing read-only capture; never writes historical evidence.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { encodeHistory } from './poll-history.ts';
import type { Row } from './ocpi-source.ts';
const body=JSON.parse(await readFile(process.argv[2],'utf8')) as Record<string,Row[]>;
const polls=body.source_poll_runs.filter(p=>p.source==='via-lietuva-ocpi'&&p.outcome==='SUCCESS'&&p.completeness==='COMPLETE'&&(p.pagination_metadata as Row).verified===true&&!(p.pagination_metadata as Row).replaySha256).sort((a,b)=>Date.parse(String(b.started_at))-Date.parse(String(a.started_at))).slice(0,2);
const latest=polls[0];const start=Date.parse(String(latest.started_at)),end=Date.parse(String(latest.completed_at));
const current=(r:Row)=>r.source==='via-lietuva-ocpi'&&start<=Date.parse(String(r.last_observed_at))&&Date.parse(String(r.last_observed_at))<=end;
const locations=body.charging_locations.filter(current),evses=body.charging_evses.filter(current);
const ids=new Set(evses.map(e=>e.id)),connectors=body.charging_connectors.filter(c=>ids.has(c.evse_id));
const counts=(latest.pagination_metadata as Row).counts as Row;
if(locations.length!==counts.locations||evses.length!==counts.evses||connectors.length!==counts.connectors)throw Error('Membership cannot be certified for sizing');
const payload=encodeHistory(locations,evses,connectors,polls);
console.log(JSON.stringify({kind:'offline_format_sizing_only_not_historical_capture',poll_id:latest.id,locations:locations.length,evses:evses.length,connectors:connectors.length,json_bytes:gunzipSync(payload).length,gzip_bytes:payload.length,polls_per_day:48,seven_day_payload_bytes:payload.length*48*7,thirty_day_archive_bytes:payload.length*48*30}));
