import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeHistory, digest, verifyHistory, saveHistory, checkHistorySchema } from './poll-history.ts';
import { publish } from './ocpi-store.ts';
const id='00000000-0000-4000-8000-000000000001';
test('gzip projection preserves fetched membership only and checksum',()=>{
  const locations=[{id,source:'test',country_code:'LT',party_id:'T',ocpi_location_id:'1',first_observed_at:'2026-10-10T00:00:01Z',last_observed_at:'2026-10-10T00:00:01Z',wireDump:'exclude'}];
  const payload=encodeHistory(locations,[],[],[{id}]);
  const body=verifyHistory(payload,digest(payload));
  assert.equal(body.charging_locations.length,1);assert.equal(body.charging_locations[0].wireDump,undefined);
  assert.throws(()=>verifyHistory(payload,'0'.repeat(64)),/checksum/);
});
test('snapshot uses exact connector rows and preserves subsecond chronology',async()=>{
  const calls=[];const poll={id,started_at:new Date('2026-10-10T00:00:00.100Z'),completed_at:new Date('2026-10-10T00:00:01Z')};
  const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:[poll]};}};
  await saveHistory(db,id,'test',[{last_observed_at:new Date('2026-10-10T00:00:00.200Z')}],[],[]);
  assert.equal(calls[1].args[2].toISOString(),'2026-10-10T00:00:00.200Z');
  assert.equal(calls[1].args[6],0);
});
test('history safety cap rejects before collection',async()=>{
  const db={query:async(sql)=>sql.includes('pg_class')?{rowCount:1,rows:[{relrowsecurity:true,anon_access:false,client_access:false}]}:{rows:[{bytes:128*1024*1024}]}};
  await assert.rejects(checkHistorySchema(db),/safety cap/);
});
test('history failure rolls back current state and poll success together',async()=>{
  const calls=[];
  const db={query:async(sql)=>{calls.push(sql);if(sql.startsWith('select id from source_poll_runs'))return {rowCount:1,rows:[{id}]};if(sql.includes('order by started_at desc limit 2'))return {rows:[]};return {rows:[],rowCount:0};}};
  await assert.rejects(publish(db,id,{locations:[],evses:[],connectors:[]},{verified:true,pages:[],duplicates:0,advertisedTotal:null},true),/History poll mismatch/);
  assert.equal(calls.at(-1),'rollback');assert.ok(!calls.includes('commit'));
});
test('replays cannot manufacture historical snapshots',async()=>{
  const calls=[];const db={query:async(sql)=>{calls.push(sql);return {rows:[],rowCount:sql.startsWith('select id from source_poll_runs')?1:0};}};
  await publish(db,id,{locations:[],evses:[],connectors:[]},{verified:true,pages:[],duplicates:0,advertisedTotal:null,replaySha256:'fixture'},true);
  assert.ok(!calls.some(sql=>sql.includes('charging_poll_snapshots')));assert.equal(calls.at(-1),'commit');
});
