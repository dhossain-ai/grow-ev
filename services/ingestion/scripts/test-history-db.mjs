// Local disposable test only. Load existing private local test URL in place.
import pg from 'pg';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const url=new URL(process.env.GROW_EV_TEST_DATABASE_URL);
if(!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!='/growev_collector_test')throw Error('Local test target required');
url.pathname='/postgres';
const admin=new pg.Client({connectionString:url.href});await admin.connect();
const name=`growev_history_test_task015_${Date.now()}`;
try{
  await admin.query(`create database ${name}`);
}finally{await admin.end();}
url.pathname='/'+name;
const db=new pg.Client({connectionString:url.href});await db.connect();
try{
  if((await db.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n)throw Error('Disposable DB is not empty; refusing overwrite');
  for(const path of ['../../supabase/migrations/20261009000100_charging_foundation.sql','../../supabase/migrations/20261010003000_charging_predictions.sql','../../supabase/migrations/20261010004000_charging_poll_snapshots.sql'])await db.query(await readFile(path,'utf8'));
  await db.query("create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key);insert into supabase_migrations.schema_migrations values('20261009000100')");
  await db.query(await readFile('../../supabase/tests/charging_predictions.sql','utf8'));
}finally{await db.end();}
const legacy=process.argv.includes('--legacy');
const result=spawnSync(process.execPath,['--test',legacy?'scripts/ocpi-store.test.mjs':'scripts/history-store.test.mjs'],{stdio:'inherit',env:{...process.env,GROW_EV_TEST_DATABASE_URL:legacy?url.href:'',GROW_EV_HISTORY_TEST_DATABASE_URL:legacy?'':url.href}});
process.exitCode=result.status??1;
if(!legacy&&result.status===0) {
  const evidence=new pg.Client({connectionString:url.href});await evidence.connect();
  try {
    const row=(await evidence.query('select payload_gzip,payload_sha256,poll_run_id from charging_poll_snapshots where evse_count>0 limit 1')).rows[0];
    await mkdir('.scratch/task015-fixture',{recursive:true});
    await writeFile(`.scratch/task015-fixture/${row.poll_run_id}_${row.payload_sha256}.json.gz`,row.payload_gzip,{flag:'wx'});
    console.log('Private synthetic cross-repository format fixture saved; no live history created.');
  }finally{await evidence.end();}
}
