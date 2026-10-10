import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { checkSchema } from './ocpi-store.ts';

const DEV_PROJECT = 'heafsrqaytsfthfcxmqu';

class ConfigurationError extends Error {
  constructor(rule: 'PROJECT_REF' | 'DATABASE_URL_REQUIRED' | 'CA_FILE_REQUIRED' | 'URL_PARSE' |
    'PROTOCOL' | 'DEV_HOST' | 'USERNAME' | 'USERNAME_ENCODING' | 'SESSION_PORT' |
    'DATABASE_NAME' | 'SSL_PARAMETER' | 'CA_FILE_READ') {
    super(`CONFIGURATION (${rule})`);
  }
}

/** Enforce the audited DEV target and session-lock-compatible connection. */
export function devConnection(env: NodeJS.ProcessEnv): URL {
  if (env.GROW_EV_PROJECT_REF !== DEV_PROJECT) throw new ConfigurationError('PROJECT_REF');
  if (!env.GROW_EV_DATABASE_URL) throw new ConfigurationError('DATABASE_URL_REQUIRED');
  if (!env.GROW_EV_DATABASE_CA_FILE) throw new ConfigurationError('CA_FILE_REQUIRED');
  let url: URL;
  try { url = new URL(env.GROW_EV_DATABASE_URL); } catch { throw new ConfigurationError('URL_PARSE'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new ConfigurationError('PROTOCOL');
  const direct = url.hostname === `db.${DEV_PROJECT}.supabase.co`;
  const pooler = url.hostname.endsWith('.pooler.supabase.com');
  if (!direct && !pooler) throw new ConfigurationError('DEV_HOST');
  let username: string;
  try { username = decodeURIComponent(url.username); } catch { throw new ConfigurationError('USERNAME_ENCODING'); }
  if ((direct && url.username !== 'postgres') || (pooler && username !== `postgres.${DEV_PROJECT}`)) throw new ConfigurationError('USERNAME');
  if (url.port !== '' && url.port !== '5432') throw new ConfigurationError('SESSION_PORT');
  if (url.pathname !== '/postgres') throw new ConfigurationError('DATABASE_NAME');
  if (url.searchParams.has('ssl')) throw new ConfigurationError('SSL_PARAMETER');
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name);
  return url;
}

/** Never return raw errors, which may contain connection details. */
export function failureCategory(error: unknown): string {
  if (error instanceof ConfigurationError) return error.message;
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (['28P01', '28000'].includes(code)) return 'AUTHENTICATION';
  if (['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'ECONNRESET'].includes(code)) return 'NETWORK';
  if (code.startsWith('ERR_TLS') || code.startsWith('CERT_') || ['SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(code)) return 'TLS';
  if (code === '42501') return 'DATABASE_AUTHORIZATION';
  if (code === '53300') return 'DATABASE_CONNECTION_LIMIT';
  if (error instanceof Error && ['CONFIGURATION', 'TLS', 'UNFINISHED_POLL', 'DATA_INTEGRITY'].includes(error.message)) return error.message;
  return 'DATABASE_OR_SCHEMA_CHECK';
}

async function main(): Promise<void> {
  const url = devConnection(process.env);
  let ca: string;
  try { ca = await readFile(process.env.GROW_EV_DATABASE_CA_FILE!, 'utf8'); } catch { throw new ConfigurationError('CA_FILE_READ'); }
  const db = new pg.Client({ connectionString: url.href, ssl: { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 15_000, query_timeout: 120_000, application_name: 'grow-ev-ocpi-preflight' });
  db.on('error', () => { /* Queries fail separately; never log connection details. */ });
  try {
    await db.connect();
    await db.query('begin transaction isolation level repeatable read read only');
    await db.query("set local statement_timeout = '60s'");
    const tls = (await db.query('select ssl, version, cipher from pg_stat_ssl where pid=pg_backend_pid()')).rows[0];
    if (tls?.ssl !== true) throw new Error('TLS');
    await checkSchema(db);
    const health = (await db.query(`select current_timestamp as checked_at, current_setting('transaction_read_only') as read_only,
      pg_is_in_recovery() as in_recovery,
      (select count(*)::int from charging_locations where source='via-lietuva-ocpi') as locations,
      (select count(*)::int from charging_evses where source='via-lietuva-ocpi') as evses,
      (select count(*)::int from charging_connectors c join charging_evses e on e.id=c.evse_id where e.source='via-lietuva-ocpi') as connectors,
      (select min(last_observed_at) from charging_evses where source='via-lietuva-ocpi') as oldest_observation,
      (select max(last_observed_at) from charging_evses where source='via-lietuva-ocpi') as latest_observation,
      (select count(*)::int from charging_evses where source='via-lietuva-ocpi' and source_last_updated_at is null) as unknown_source_update_times,
      (select count(*)::int from source_poll_runs where source='via-lietuva-ocpi' and outcome='RUNNING') as unfinished_polls,
      (select count(*)::int from charging_evses where source='via-lietuva-ocpi' and
        (last_observed_at < first_observed_at or last_observed_at > current_timestamp)) as invalid_observation_times,
      (select count(*)::int from evse_status_transitions where source='via-lietuva-ocpi' and
        (new_observed_at <= previous_observed_at or
         (new_status = previous_status and new_source_status is not distinct from previous_source_status))) as invalid_transitions,
      (select count(*)::int from (select 1 from charging_locations where source='via-lietuva-ocpi'
        group by source,country_code,party_id,ocpi_location_id having count(*)>1) d) as duplicate_locations,
      (select count(*)::int from (select 1 from charging_evses where source='via-lietuva-ocpi'
        group by source,country_code,party_id,uid having count(*)>1) d) as duplicate_evses,
      (select count(*)::int from (select 1 from charging_connectors c join charging_evses e on e.id=c.evse_id
        where e.source='via-lietuva-ocpi' group by c.evse_id,c.connector_id having count(*)>1) d) as duplicate_connectors`)).rows[0];
    const polls = (await db.query(`select id,started_at,completed_at,outcome,completeness,records_retrieved,pages_retrieved,
      extract(epoch from completed_at-started_at) as duration_seconds,
      pagination_metadata->'counts' as fetched_counts, pagination_metadata->'transitions' as transitions
      from source_poll_runs where source='via-lietuva-ocpi' order by started_at desc limit 5`)).rows;
    const latestSuccess = (await db.query(`select id,completed_at,completeness from source_poll_runs
      where source='via-lietuva-ocpi' and outcome='SUCCESS' order by completed_at desc limit 1`)).rows[0] ?? null;
    await db.query('rollback');
    console.log(JSON.stringify({ project: DEV_PROJECT, tls, health, latestSuccess, polls }, null, 2));
    if (health.unfinished_polls > 0) throw new Error('UNFINISHED_POLL');
    if (health.invalid_observation_times || health.invalid_transitions || health.duplicate_locations || health.duplicate_evses || health.duplicate_connectors) throw new Error('DATA_INTEGRITY');
  } finally { await db.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(error => {
  console.error(`OCPI preflight failed: ${failureCategory(error)}. Private error details withheld; no collector executed.`);
  process.exitCode = 1;
});
