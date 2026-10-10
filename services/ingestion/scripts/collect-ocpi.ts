import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { fetchSnapshot, parseLocations, snapshotIdentities, type Evidence } from './ocpi-source.ts';
import { checkSchema, collect } from './ocpi-store.ts';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let capturePath: string | undefined, replayPath: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (seen.has(flag)) throw new Error('Duplicate command argument');
    seen.add(flag);
    if (flag === '--capture' || flag === '--replay') {
      const path = args[++i];
      if (!path || path.startsWith('--')) throw new Error('Missing capture/replay path');
      if (flag === '--capture') capturePath = path;
      else replayPath = path;
    } else if (flag !== '--dry-run' && flag !== '--check') throw new Error('Invalid command argument');
  }
  if (capturePath && replayPath) throw new Error('Cannot capture and replay together');
  if (seen.has('--check') && (seen.has('--dry-run') || capturePath || replayPath)) throw new Error('--check is a separate read-only command');
  const load = async (evidence: Evidence) => {
    if (replayPath) {
      const artifact = JSON.parse(await readFile(replayPath, 'utf8')) as { envelope: unknown; evidence: Evidence; sha256: string };
      if (createHash('sha256').update(JSON.stringify(artifact.envelope)).digest('hex') !== artifact.sha256 || artifact.evidence?.verified !== true || !Array.isArray(artifact.evidence.pages)) throw new Error('Unverified or modified replay artifact');
      const snapshot = parseLocations(artifact.envelope, new Date().toISOString());
      Object.assign(evidence, artifact.evidence);
      evidence.replaySha256 = artifact.sha256;
      return snapshot;
    }
    return fetchSnapshot(evidence, fetch, undefined, capturePath ? async envelope => {
      await mkdir(dirname(capturePath), { recursive: true });
      await writeFile(capturePath, JSON.stringify({ envelope, evidence, sha256: createHash('sha256').update(JSON.stringify(envelope)).digest('hex') }), { flag: 'wx' });
    } : undefined);
  };
  if (args.includes('--dry-run')) {
    const evidence: Evidence = { pages: [], duplicates: 0, advertisedTotal: null, verified: false };
    const snapshot = await load(evidence);
    console.log(JSON.stringify({ dryRun: true, counts: { locations: snapshot.locations.length, evses: snapshot.evses.length, connectors: snapshot.connectors.length }, identityCount: snapshotIdentities(snapshot).length, evidence }, null, 2));
    return;
  }
  const connectionString = process.env.GROW_EV_DATABASE_URL;
  const expectedRef = process.env.GROW_EV_PROJECT_REF;
  if (!connectionString || !expectedRef) throw new Error('Set server-side GROW_EV_DATABASE_URL and GROW_EV_PROJECT_REF in .env.local');
  const url = new URL(connectionString);
  if (url.hostname !== `db.${expectedRef}.supabase.co` && !(url.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(url.username) === `postgres.${expectedRef}`)) throw new Error('Connection does not match the expected Supabase project');
  // Remove URL TLS overrides; require certificate verification and encryption.
  for (const name of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(name);
  const ca = process.env.GROW_EV_DATABASE_CA_FILE
    ? await readFile(process.env.GROW_EV_DATABASE_CA_FILE, 'utf8') : undefined;
  const db = new pg.Client({ connectionString: url.href, ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 15_000, query_timeout: 120_000, application_name: 'grow-ev-ocpi-collector' });
  db.on('error', () => { /* Connection details must never enter logs. Queries fail separately. */ });
  try {
    await db.connect();
    await checkSchema(db);
    if (args.includes('--check')) { console.log(JSON.stringify({ schemaCheck: 'passed', project: expectedRef })); return; }
    const result = await collect(db, load, process.env.GROW_EV_HISTORY_ENABLED === 'approved');
    if (process.env.GROW_EV_COLLECTION_RECEIPT) {
      const poll = (await db.query('select * from public.source_poll_runs where id=$1', [result.runId])).rows[0];
      const history = await db.query('select payload_sha256,octet_length(payload_gzip) as bytes from public.charging_poll_snapshots where poll_run_id=$1', [result.runId]);
      if (history.rowCount !== 1 || poll.outcome !== 'SUCCESS' || poll.completeness !== 'COMPLETE' || poll.pagination_metadata.replaySha256) throw new Error('Missing genuine historical snapshot receipt');
      await writeFile(process.env.GROW_EV_COLLECTION_RECEIPT, JSON.stringify({ poll_id: result.runId, completed_at: poll.completed_at, history: history.rows[0], github_run_id: process.env.GITHUB_RUN_ID, dispatch_id: process.env.GROW_EV_DISPATCH_ID }), { flag: 'wx' });
    }
    const stored = await db.query(`select
      (select count(*)::int from charging_locations where source='via-lietuva-ocpi') as locations,
      (select count(*)::int from charging_evses where source='via-lietuva-ocpi') as evses,
      (select count(*)::int from charging_connectors c join charging_evses e on e.id=c.evse_id where e.source='via-lietuva-ocpi') as connectors,
      (select count(*)::int from evse_status_transitions where poll_run_id=$1) as transitions`, [result.runId]);
    console.log(JSON.stringify({ runId: result.runId, fetched: { locations: result.snapshot.locations.length, evses: result.snapshot.evses.length, connectors: result.snapshot.connectors.length }, stored: stored.rows[0], transitions: result.transitions }, null, 2));
  } finally { await db.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main().catch(() => {
  console.error('OCPI collection failed. Check configuration, schema and source_poll_runs; credentials and raw database errors are withheld.');
  process.exitCode = 1;
});
