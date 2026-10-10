import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveOne } from './archive-history.ts';
import { encodeHistory,digest } from './poll-history.ts';
function fixture(){const payload=encodeHistory([],[],[],[]);return {poll_run_id:'00000000-0000-4000-8000-000000000001',completed_at:'2026-10-10T00:00:00Z',retention_eligible:true,payload_gzip:payload,payload_sha256:digest(payload)};}
test('failed durable download never permits database deletion',async()=>{
  const row=fixture();let deletes=0;const db={query:async()=>{deletes++;return {rowCount:1};}};
  await assert.rejects(archiveOne(db,row,'https://fixture.invalid',{},true,async(_url,init)=>init?.method==='POST'?new Response(null,{status:200}):new Response('changed')),/verification failed/);
  assert.equal(deletes,0);
});
test('existing immutable archive is verified before approved compact pruning',async()=>{
  const row=fixture();const steps=[];const db={query:async sql=>{steps.push('delete');assert.ok(sql.includes("interval '3 days'"));return {rowCount:1};}};
  const request=async(_url,init)=>{if(init?.method==='POST'){steps.push('upload');return new Response(null,{status:409});}steps.push('download');return new Response(row.payload_gzip);};
  assert.deepEqual(await archiveOne(db,row,'https://fixture.invalid',{},true,request),{uploaded:false,deleted:1});
  assert.deepEqual(steps,['upload','download','delete']);
});
test('pruning requires both explicit approval and eligible age',async()=>{
  for(const [approved,eligible] of [[false,true],[true,false]]){
    const row={...fixture(),retention_eligible:eligible};const db={query:async()=>assert.fail('unexpected delete')};
    const result=await archiveOne(db,row,'https://fixture.invalid',{},approved,async(_url,init)=>init?.method==='POST'?new Response(null,{status:200}):new Response(row.payload_gzip));
    assert.equal(result.deleted,0);
  }
});
