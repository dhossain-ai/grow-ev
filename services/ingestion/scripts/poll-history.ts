import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import type { Client } from 'pg';
import type { Row } from './ocpi-source.ts';

// These fields preserve the existing Python feature/identity contract, without wire dumps.
const fields = {
  charging_locations: ['id','source','country_code','party_id','ocpi_location_id','first_observed_at','last_observed_at'],
  charging_evses: ['id','source','country_code','party_id','uid','location_id','current_status','source_status','first_observed_at','last_observed_at'],
  charging_connectors: ['id','evse_id','connector_id','standard','rated_power_w'],
};
export function encodeHistory(locations: Row[], evses: Row[], connectors: Row[], polls: Row[]): Buffer {
  const body: Row = { schema_version: 1, source_poll_runs: polls };
  for (const [table, rows] of Object.entries({ charging_locations: locations, charging_evses: evses, charging_connectors: connectors })) {
    body[table] = rows.map(row => Object.fromEntries(fields[table as keyof typeof fields].map(f => [f, row[f]])));
  }
  return gzipSync(JSON.stringify(body), { level: 9 });
}
export function digest(payload: Uint8Array): string { return createHash('sha256').update(payload).digest('hex'); }
export function verifyHistory(payload: Buffer, expectedHash: string): Row {
  if (digest(payload) !== expectedHash) throw new Error('History checksum mismatch');
  const body = JSON.parse(gunzipSync(payload, { maxOutputLength: 64 * 1024 * 1024 }).toString()) as Row;
  if (body.schema_version !== 1 || !Array.isArray(body.source_poll_runs)) throw new Error('History schema mismatch');
  return body;
}
export async function checkHistorySchema(db: Client): Promise<void> {
  const result = await db.query(`select c.relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') as client_access
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='charging_poll_snapshots'`);
  if (result.rowCount !== 1 || !result.rows[0].relrowsecurity || result.rows[0].anon_access || result.rows[0].client_access) throw new Error('History schema/security mismatch');
  await db.query('select poll_run_id,source,schema_version,observed_oldest_at,observed_newest_at,location_count,evse_count,connector_count,payload_gzip,payload_sha256 from public.charging_poll_snapshots limit 0');
  // Fail closed before source I/O. Pruning requires separate approved archive proof.
  const size = await db.query("select pg_total_relation_size('public.charging_poll_snapshots') as bytes");
  if (Number(size.rows[0].bytes) >= 128 * 1024 * 1024) throw new Error('History reached 128 MiB safety cap; archive/retention review required');
  const database = await db.query('select pg_database_size(current_database()) as bytes');
  if (Number(database.rows[0].bytes) >= 400 * 1024 * 1024) throw new Error('Database reached 400 MiB safety cap; quota review required');
}
export async function saveHistory(db: Client, runId: string, source: string, locations: Row[], evses: Row[], connectors: Row[]): Promise<void> {
  // Current + immediate genuine predecessor make missing archive intervals detectable.
  const polls = await db.query(`select id,source,started_at::text as started_at,completed_at::text as completed_at,outcome,completeness,pagination_metadata
    from public.source_poll_runs where source=$1 and outcome='SUCCESS' and completeness='COMPLETE'
    and pagination_metadata->>'verified'='true' and not (pagination_metadata ? 'replaySha256')
    order by started_at desc limit 2`, [source]);
  if (polls.rows[0]?.id !== runId) throw new Error('History poll mismatch');
  const payload = encodeHistory(locations, evses, connectors, polls.rows);
  const times = [...locations, ...evses].map(r => new Date(r.last_observed_at as string).getTime());
  const oldest = times.length ? new Date(Math.min(...times)) : polls.rows[0].started_at;
  const newest = times.length ? new Date(Math.max(...times)) : polls.rows[0].started_at;
  if (new Date(oldest).getTime() < new Date(polls.rows[0].started_at).getTime() || new Date(newest).getTime() > new Date(polls.rows[0].completed_at).getTime()) throw new Error('History observation chronology mismatch');
  await db.query(`insert into public.charging_poll_snapshots
    (poll_run_id,source,schema_version,observed_oldest_at,observed_newest_at,location_count,evse_count,connector_count,payload_gzip,payload_sha256)
    values($1,$2,1,$3,$4,$5,$6,$7,$8,$9)`, [runId,source,oldest,newest,locations.length,evses.length,connectors.length,payload,digest(payload)]);
}
