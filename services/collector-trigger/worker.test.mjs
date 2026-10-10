import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { CollectorCoordinator, health } from './worker.ts';
const env = { ENABLED: 'approved', GITHUB_REF: 'main', GITHUB_TOKEN: 'fixture', STATUS_TOKEN: 'fixture' };
function coordinator() { const values = new Map(); return new CollectorCoordinator({storage:{get:async k=>values.get(k),put:async(k,v)=>values.set(k,structuredClone(v))}}, env); }
const trigger = () => new Request('https://internal/dispatch',{method:'POST',body:JSON.stringify({scheduledTime:Date.now()})});
test('disabled coordinator makes no requests',async()=>{
  const c=new CollectorCoordinator({storage:{}},{...env,ENABLED:'false'});
  assert.equal((await (await c.fetch(trigger())).json()).status,'disabled');
});
test('durable reservation prevents repeated/parallel ambiguous POST',async()=>{
  const original=globalThis.fetch; let posts=0;
  globalThis.fetch=async(_url,init)=>{if(init?.method==='POST'){posts++;throw Error('ambiguous');}return Response.json({workflow_runs:[]});};
  try { const c=coordinator(); await Promise.all([c.fetch(trigger()),c.fetch(trigger())]);assert.equal(posts,1); }
  finally {globalThis.fetch=original;}
});
test('active collector and inspection failure prevent dispatch',async()=>{
  const original=globalThis.fetch;let posts=0;
  globalThis.fetch=async(_url,init)=>{if(init?.method==='POST')posts++;return Response.json({workflow_runs:[{id:1,display_title:'Collect Chargers',status:'queued',updated_at:new Date().toISOString()}]});};
  try{assert.equal((await(await coordinator().fetch(trigger())).json()).status,'collector_active_no_dispatch');assert.equal(posts,0);
    globalThis.fetch=async()=>new Response('',{status:429});assert.equal((await coordinator().fetch(trigger())).status,503);}
  finally{globalThis.fetch=original;}
});
test('success health excludes preflight and flags missed polls',()=>{
  const now=Date.now();const run={id:1,display_title:'Permanent collection / cf-1',conclusion:'success',updated_at:new Date(now).toISOString()};
  assert.equal(health([run],now).missed_successful_poll,false);
  assert.equal(health([{...run,display_title:'Collect Chargers'}],now).missed_successful_poll,true);
  assert.equal(health([run],now+76*60*1000).missed_successful_poll,true);
});
test('public dispatch unavailable and health requires secret',async()=>{
  assert.equal((await worker.fetch(new Request('https://worker/dispatch'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://worker/health'),env)).status,401);
});
