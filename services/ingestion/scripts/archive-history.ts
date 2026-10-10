// Private durable storage; compact pruning requires approval and durable checksum proof.
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { devConnection } from './preflight-ocpi.ts';
import { digest, verifyHistory } from './poll-history.ts';
import { pathToFileURL } from 'node:url';

interface ArchiveRow { poll_run_id: string; payload_gzip: Buffer; payload_sha256: string; completed_at: Date | string; retention_eligible: boolean }
export async function archiveOne(db: Pick<pg.Client,'query'>, row: ArchiveRow, base: string, headers: Record<string,string>, prune: boolean, request: typeof fetch = fetch): Promise<{uploaded:boolean;deleted:number}> {
  verifyHistory(row.payload_gzip,row.payload_sha256);
  const time=new Date(row.completed_at).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const name=`${time}_${row.poll_run_id}_${row.payload_sha256}.json.gz`;
  const url=`${base}/object/grow-ev-poll-history/v1/${name}`;
  const upload=await request(url,{method:'POST',headers:{...headers,'Content-Type':'application/gzip','x-upsert':'false'},body:Uint8Array.from(row.payload_gzip),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!upload.ok&&upload.status!==409&&upload.status!==400)throw new Error('Archive upload failed');
  const download=await request(`${base}/object/authenticated/grow-ev-poll-history/v1/${name}`,{headers,signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!download.ok||digest(new Uint8Array(await download.arrayBuffer()))!==row.payload_sha256)throw new Error('Durable archive verification failed');
  let deleted=0;
  if(prune&&row.retention_eligible) {
    const removed=await db.query(`delete from public.charging_poll_snapshots s using public.source_poll_runs p
      where s.poll_run_id=$1 and s.payload_sha256=$2 and p.id=s.poll_run_id
      and p.completed_at < current_timestamp-interval '3 days'`,[row.poll_run_id,row.payload_sha256]);
    deleted=removed.rowCount??0;
  }
  return {uploaded:upload.ok,deleted};
}

async function main(): Promise<void> {
  const ref = process.env.GROW_EV_PROJECT_REF;
  const token = process.env.GROW_EV_ARCHIVE_SERVICE_KEY;
  if (!token || !ref || !process.env.GROW_EV_DATABASE_CA_FILE) throw new Error('Missing archive configuration');
  const connectionString=devConnection(process.env).href; // Exact DEV guard before any privileged request.
  const base = `https://${ref}.supabase.co/storage/v1`;
  const headers = { Authorization: `Bearer ${token}`, apikey: token };
  const storageRequest = async (url: string, init?: RequestInit): Promise<Response> => fetch(url, { ...init, headers: { ...headers, ...init?.headers }, signal:AbortSignal.timeout(30000),redirect:'error' });
  const bucket = await fetch(`${base}/bucket/grow-ev-poll-history`, { headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!bucket.ok || (await bucket.json() as { public?: boolean }).public !== false) throw new Error('Archive bucket missing or not private');
  let bucketBytes=0;
  for(let offset=0;offset<10000;offset+=100) {
    const listing=await storageRequest(`${base}/object/list/grow-ev-poll-history`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:'v1',offset,limit:100,sortBy:{column:'name',order:'asc'}})});
    if(!listing.ok)throw new Error('Archive quota inspection failed');
    const objects=await listing.json() as {metadata?:{size?:number}}[];
    if(!Array.isArray(objects)||objects.some(o=>!Number.isSafeInteger(o.metadata?.size)||Number(o.metadata?.size)<0))throw new Error('Archive size evidence unavailable');
    bucketBytes+=objects.reduce((n,o)=>n+Number(o.metadata?.size),0);
    if(bucketBytes>=800*1024*1024)throw new Error('Archive reached 800 MiB cap; durable secondary archival and quota review required');
    if(objects.length<100)break;
    if(offset===9900)throw new Error('Archive listing exceeded bound');
  }
  const db = new pg.Client({ connectionString,
    ssl: { rejectUnauthorized: true, ca: await readFile(process.env.GROW_EV_DATABASE_CA_FILE,'utf8') }, connectionTimeoutMillis:15000 });
  db.on('error',()=>{});
  try {
    await db.connect();
    await db.query('begin isolation level repeatable read read only');
    await db.query("set local statement_timeout='60s'");
    const receipt = process.env.GROW_EV_COLLECTION_RECEIPT ? JSON.parse(await readFile(process.env.GROW_EV_COLLECTION_RECEIPT,'utf8')) as {poll_id:string} : undefined;
    const prune=process.env.GROW_EV_HISTORY_PRUNE==='approved';
    const rows = await db.query(`select s.*,p.completed_at,
      p.completed_at < current_timestamp-interval '3 days' as retention_eligible
      from public.charging_poll_snapshots s
      join public.source_poll_runs p on p.id=s.poll_run_id
      where ($1::uuid is null or s.poll_run_id=$1 or ($2 and p.completed_at < current_timestamp-interval '3 days'))
      order by p.completed_at desc limit 336`, [receipt?.poll_id ?? null,prune]);
    await db.query('rollback');
    if (!rows.rowCount) throw new Error('No history to archive');
    let totalBytes=0;
    let deleted=0;
    for (const row of rows.rows) {
      if(bucketBytes+(row.payload_gzip as Buffer).length>800*1024*1024)throw new Error('Archive cap would be exceeded; DB history retained');
      const verified=await archiveOne(db,row as ArchiveRow,base,headers,prune);
      if(verified.uploaded)bucketBytes+=(row.payload_gzip as Buffer).length;
      totalBytes += (row.payload_gzip as Buffer).length;
      deleted+=verified.deleted;
    }
    console.log(JSON.stringify({ durable_archives_verified:rows.rowCount,compressed_bytes:totalBytes,database_snapshot_deletes:deleted }));
  } finally { await db.end(); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main().catch(()=>{ console.error('Private archival failed; details withheld. Unverified DB history retained.');process.exitCode=1; });
