import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { SOURCE, key, type Row, type Snapshot, type Evidence } from './ocpi-source.ts';

const tables = ['charging_locations', 'charging_evses', 'charging_connectors', 'source_poll_runs', 'evse_status_transitions'];
export async function checkSchema(db: Client): Promise<void> {
  const result = await db.query(`select c.relname, c.relrowsecurity,
    has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
    has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as client_access
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=any($1::text[])`, [tables]);
  // Local vanilla PostgreSQL tests create these roles before applying the foundation.
  if (result.rows.length !== 5 || result.rows.some(r => !r.relrowsecurity || r.anon_access || r.client_access)) throw new Error('Schema/security mismatch; stop before writing');
  const migration = await db.query(`select version from supabase_migrations.schema_migrations where version='20261009000100'`);
  if (migration.rowCount !== 1) throw new Error('Foundation migration is missing; stop before writing');
  // Parse-only queries verify the exact columns used by ingestion without writing.
  await db.query(`select source,country_code,party_id,ocpi_location_id,operator_name,operator_website,name,address,city,country,latitude,longitude,source_last_updated_text,source_last_updated_at,source_metadata,first_observed_at,last_observed_at from charging_locations limit 0`);
  await db.query(`select id,location_id,source,country_code,party_id,uid,public_evse_id,current_status,source_status,source_last_updated_text,source_last_updated_at,source_metadata,first_observed_at,last_observed_at from charging_evses limit 0`);
  await db.query(`select evse_id,connector_id,standard,format,power_type,rated_power_w,voltage,amperage,tariff_ids,source_last_updated_text,source_last_updated_at from charging_connectors limit 0`);
  await db.query(`select id,source,started_at,completed_at,outcome,completeness,records_retrieved,pages_retrieved,advertised_total_count,requested_page_limit,pagination_metadata,error_information from source_poll_runs limit 0`);
  await db.query(`select evse_id,source,poll_run_id,previous_status,new_status,previous_source_status,new_source_status,previous_observed_at,new_observed_at,source_last_updated_text,source_last_updated_at from evse_status_transitions limit 0`);
}

async function upsert(db: Client, table: string, rows: Row[], conflict: string[]): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250), columns = Object.keys(batch[0]);
    const values: unknown[] = [];
    const tuples = batch.map(row => '(' + columns.map(column => { values.push(row[column]); return '$' + values.length; }).join(',') + ')');
    const updates = columns.filter(c => !conflict.includes(c) && c !== 'first_observed_at').map(c => `${c}=excluded.${c}`);
    // All SQL identifiers originate from fixed internal row shapes, never wire keys.
    const response = await db.query(`insert into ${table} (${columns.join(',')}) values ${tuples.join(',')} on conflict (${conflict.join(',')}) do update set ${updates.join(',')} returning *`, values);
    result.push(...response.rows as Row[]);
  }
  return result;
}

export async function beginPoll(db: Client): Promise<string> {
  const runId = randomUUID();
  await db.query(`insert into source_poll_runs(id,source,started_at) values($1,$2,clock_timestamp())`, [runId, SOURCE]);
  return runId;
}
export async function failPoll(db: Client, runId: string, evidence: Evidence, stage: string): Promise<void> {
  await db.query(`update source_poll_runs set outcome='FAILURE',completeness=$2,completed_at=clock_timestamp(),records_retrieved=$3,pages_retrieved=$4,advertised_total_count=$5,requested_page_limit=1000,pagination_metadata=$6,error_information=$7 where id=$1 and outcome='RUNNING'`, [runId, evidence.pages.length ? 'PARTIAL' : 'UNKNOWN', evidence.pages.filter(p => p.limit === 1000).reduce((n, p) => n + p.returned, 0), evidence.pages.length, evidence.advertisedTotal, evidence, stage]);
}
export async function publish(db: Client, runId: string, snapshot: Snapshot, evidence: Evidence): Promise<number> {
  if (!evidence.verified) throw new Error('Cannot publish an unverified fetch');
  await db.query('begin');
  try {
    const run = await db.query(`select id from source_poll_runs where id=$1 and source=$2 and outcome='RUNNING' for update`, [runId, SOURCE]);
    if (run.rowCount !== 1) throw new Error('Poll is not RUNNING');
    const existingLocations = await db.query('select * from charging_locations where source=$1 for update', [SOURCE]);
    const oldLocations = new Map<string, Row>(existingLocations.rows.map(l => [key(l.source, l.country_code, l.party_id, l.ocpi_location_id), l]));
    for (const l of snapshot.locations) {
      const p = oldLocations.get(key(l.source, l.country_code, l.party_id, l.ocpi_location_id));
      if (p && Date.parse(String(l.last_observed_at)) < new Date(p.last_observed_at as string).getTime()) throw new Error('Stale location observation');
    }
    const locationRows = await upsert(db, 'charging_locations', snapshot.locations, ['source', 'country_code', 'party_id', 'ocpi_location_id']);
    const locationIds = new Map(locationRows.map(l => [key(l.source, l.country_code, l.party_id, l.ocpi_location_id), l.id]));
    const evseRows: Row[] = snapshot.evses.map(({ location_key, ...row }) => ({ ...row, location_id: locationIds.get(String(location_key)) }));
    const previous = await db.query(`select * from charging_evses where source=$1 for update`, [SOURCE]);
    const old = new Map<string, Row>(previous.rows.map(e => [key(e.source, e.country_code, e.party_id, e.uid), e]));
    const transitionRows: Row[] = [];
    for (const e of evseRows) {
      const p = old.get(key(e.source, e.country_code, e.party_id, e.uid));
      if (!p) continue;
      const before = new Date(p.last_observed_at as string).getTime(), now = Date.parse(String(e.last_observed_at));
      const changed = p.current_status !== e.current_status || p.source_status !== e.source_status;
      if (now < before || (changed && now === before)) throw new Error('Stale or unordered observation; refuse state overwrite');
      if (changed) transitionRows.push({ evse_id: p.id, source: SOURCE, poll_run_id: runId, previous_status: p.current_status, new_status: e.current_status, previous_source_status: p.source_status, new_source_status: e.source_status, previous_observed_at: p.last_observed_at, new_observed_at: e.last_observed_at, source_last_updated_text: e.source_last_updated_text, source_last_updated_at: e.source_last_updated_at });
    }
    for (const t of transitionRows) {
      const columns = Object.keys(t);
      await db.query(`insert into evse_status_transitions(${columns.join(',')}) values(${columns.map((_, i) => '$' + (i + 1)).join(',')})`, Object.values(t));
    }
    const savedEvses = await upsert(db, 'charging_evses', evseRows, ['source', 'country_code', 'party_id', 'uid']);
    const evseIds = new Map(savedEvses.map(e => [key(e.source, e.country_code, e.party_id, e.uid), e.id]));
    await upsert(db, 'charging_connectors', snapshot.connectors.map(({ evse_key, ...row }) => ({ ...row, evse_id: evseIds.get(String(evse_key)) })), ['evse_id', 'connector_id']);
    await db.query(`update source_poll_runs set outcome='SUCCESS',completeness='COMPLETE',completed_at=clock_timestamp(),records_retrieved=$2,pages_retrieved=$3,advertised_total_count=$4,requested_page_limit=1000,pagination_metadata=$5 where id=$1`, [runId, snapshot.locations.length, evidence.pages.length, evidence.advertisedTotal, { ...evidence, counts: { locations: snapshot.locations.length, evses: snapshot.evses.length, connectors: snapshot.connectors.length }, transitions: transitionRows.length }]);
    await db.query('commit');
    return transitionRows.length;
  } catch (error) {
    await db.query('rollback');
    throw error;
  }
}

export async function collect(db: Client, load: (e: Evidence) => Promise<Snapshot>): Promise<{ runId: string; snapshot: Snapshot; transitions: number }> {
  // Session lock includes fetching: a slower older poll cannot overwrite a newer one.
  const lock = await db.query(`select pg_try_advisory_lock(hashtextextended($1,0)) as acquired`, [SOURCE]);
  if (!lock.rows[0].acquired) throw new Error('Another collector owns this source');
  const evidence: Evidence = { pages: [], duplicates: 0, advertisedTotal: null, verified: false };
  let runId: string | undefined;
  let stage = 'Poll initialization failed';
  try {
    runId = await beginPoll(db);
    stage = 'Fetch or validation failed; no current state published';
    const snapshot = await load(evidence);
    stage = 'Database publication failed; transaction rolled back or commit outcome uncertain';
    const transitions = await publish(db, runId, snapshot, evidence);
    return { runId, snapshot, transitions };
  } catch (error) {
    if (runId) { try { await failPoll(db, runId, evidence, stage); } catch { /* A lost connection leaves RUNNING as interruption evidence. */ } }
    throw new Error(stage);
  } finally {
    await db.query(`select pg_advisory_unlock(hashtextextended($1,0))`, [SOURCE]).catch(() => undefined);
  }
}
