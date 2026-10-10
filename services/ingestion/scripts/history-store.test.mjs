import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { parseLocations } from './ocpi-source.ts';
import { collect, publish, checkSchema } from './ocpi-store.ts';
import { verifyHistory, checkHistorySchema } from './poll-history.ts';
const connectionString=process.env.GROW_EV_HISTORY_TEST_DATABASE_URL;
test('disposable PostgreSQL genuine poll snapshot security, membership and atomicity',{skip:!connectionString},async t=>{
  const url=new URL(connectionString);assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.match(url.pathname,/^\/growev_history_test_task015_\d+$/);
  const db=new pg.Client({connectionString});await db.connect();
  const fixture=JSON.parse(await readFile(new URL('../fixtures/ocpi-locations.sample.json',import.meta.url),'utf8'));
  const load=async evidence=>{Object.assign(evidence,{verified:true,duplicates:0});return parseLocations(fixture,new Date().toISOString());};
  try{
    await checkSchema(db);await checkHistorySchema(db);
    let first;
    await t.test('atomic genuine capture reconstructs distinct EVSE/connector membership',async()=>{
      first=await collect(db,load,true);
      const stored=(await db.query('select * from public.charging_poll_snapshots where poll_run_id=$1',[first.runId])).rows[0];
      const body=verifyHistory(stored.payload_gzip,stored.payload_sha256);
      assert.equal(body.charging_evses.length,1);assert.equal(body.charging_connectors.length,1);
      assert.equal(body.source_poll_runs[0].id,first.runId);assert.equal(body.source_poll_runs[0].outcome,'SUCCESS');
      assert.equal(stored.evse_count,1);
    });
    await t.test('completed poll cannot be overwritten or duplicated',async()=>{
      await assert.rejects(publish(db,first.runId,parseLocations(fixture,new Date().toISOString()),{verified:true,pages:[],duplicates:0},true),/RUNNING/);
      assert.equal((await db.query('select count(*)::int n from public.charging_poll_snapshots')).rows[0].n,1);
    });
    await t.test('database rejects snapshot mutation and incorrect counts',async()=>{
      await assert.rejects(db.query('update charging_poll_snapshots set evse_count=2'),/immutable/);
      const row=(await db.query('select * from charging_poll_snapshots limit 1')).rows[0];
      await assert.rejects(db.query(`insert into charging_poll_snapshots select poll_run_id,source,schema_version,observed_oldest_at,observed_newest_at,location_count,evse_count+1,connector_count,payload_gzip,payload_sha256 from charging_poll_snapshots where poll_run_id=$1`,[row.poll_run_id]),/exact counts/);
    });
    await t.test('omitted members retained in current inventory but absent from history',async()=>{
      const result=await collect(db,async e=>{e.verified=true;return parseLocations({...fixture,data:[]},new Date().toISOString());},true);
      const row=(await db.query('select * from public.charging_poll_snapshots where poll_run_id=$1',[result.runId])).rows[0];
      assert.equal(row.evse_count,0);assert.equal(verifyHistory(row.payload_gzip,row.payload_sha256).charging_evses.length,0);
      assert.equal((await db.query('select count(*)::int n from public.charging_evses')).rows[0].n,1);
    });
    await t.test('snapshot insertion failure rolls back all state and records failed poll',async()=>{
      const before=(await db.query('select last_observed_at from charging_evses')).rows[0].last_observed_at;
      const original=db.query;db.query=function(sql,...args){if(typeof sql==='string'&&sql.startsWith('insert into public.charging_poll_snapshots'))throw Error('fixture history failure');return original.call(this,sql,...args);};
      try{await assert.rejects(collect(db,load,true));}finally{db.query=original;}
      assert.equal((await db.query('select last_observed_at from charging_evses')).rows[0].last_observed_at.toISOString(),before.toISOString());
      assert.equal((await db.query('select outcome from source_poll_runs order by started_at desc limit 1')).rows[0].outcome,'FAILURE');
    });
    await t.test('RLS and explicit permissions reject public reads/writes and service mutation',async()=>{
      const row=(await db.query("select has_table_privilege('anon','public.charging_poll_snapshots','SELECT,INSERT,UPDATE,DELETE') a, has_table_privilege('authenticated','public.charging_poll_snapshots','SELECT,INSERT,UPDATE,DELETE') b, has_table_privilege('service_role','public.charging_poll_snapshots','UPDATE,DELETE') c")).rows[0];
      assert.deepEqual(row,{a:false,b:false,c:false});
      await db.query('set role anon');try{await assert.rejects(db.query('select * from public.charging_poll_snapshots'),/permission denied/);}finally{await db.query('reset role');}
    });
  }finally{await db.end();}
});
