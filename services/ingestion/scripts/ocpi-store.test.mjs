import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { parseLocations } from './ocpi-source.ts';
import { beginPoll, checkSchema, collect, failPoll, publish } from './ocpi-store.ts';

const connectionString = process.env.GROW_EV_TEST_DATABASE_URL;
const fixture = JSON.parse(await readFile(new URL('../fixtures/ocpi-locations.sample.json', import.meta.url), 'utf8'));
const evidence = () => ({ pages: [], duplicates: 0, advertisedTotal: 1, verified: true });
const snapshot = (minute, f = fixture) => parseLocations(f, `2026-10-10T10:${String(minute).padStart(2,'0')}:00Z`);
test('PostgreSQL atomic ingestion, history, failures, interruption and source serialization', { skip: !connectionString }, async t => {
  const url = new URL(connectionString);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.match(url.pathname, /^\/growev_(collector_test|history_test_task015_\d+)$/);
  const db = new pg.Client({ connectionString }); await db.connect();
  assert.equal((await db.query('select current_database() as name')).rows[0].name, url.pathname.slice(1));
  const counts = async () => (await db.query(`select (select count(*)::int from charging_locations) locations,(select count(*)::int from charging_evses) evses,(select count(*)::int from charging_connectors) connectors,(select count(*)::int from evse_status_transitions) transitions`)).rows[0];
  async function ingest(s) { const id = await beginPoll(db); return { id, transitions: await publish(db, id, s, evidence()) }; }
  try {
    await checkSchema(db);
    const optional = await db.query("select to_regclass('public.charging_poll_snapshots') s, to_regclass('public.charging_predictions') p");
    const dependent = [optional.rows[0].s ? 'charging_poll_snapshots' : '', optional.rows[0].p ? 'charging_predictions' : ''].filter(Boolean);
    await db.query('truncate '+[...dependent,'charging_connectors','evse_status_transitions','charging_evses','charging_locations','source_poll_runs'].join(','));
    await t.test('first observation is a baseline; unchanged runs preserve first observation', async () => {
      assert.equal((await ingest(snapshot(0))).transitions, 0);
      assert.equal((await ingest(snapshot(1))).transitions, 0);
      assert.deepEqual(await counts(), { locations: 1, evses: 1, connectors: 1, transitions: 0 });
      const row = (await db.query('select * from charging_evses')).rows[0];
      assert.equal(row.first_observed_at.toISOString(), '2026-10-10T10:00:00.000Z');
      assert.equal(row.last_observed_at.toISOString(), '2026-10-10T10:01:00.000Z');
    });
    const changed = structuredClone(fixture); changed.data[0].evses[0].status = 'CHARGING';
    await t.test('genuine transition preserves last previous, first new and original source time', async () => {
      assert.equal((await ingest(snapshot(2, changed))).transitions, 1);
      assert.equal((await ingest(snapshot(3, changed))).transitions, 0);
      const row = (await db.query('select * from evse_status_transitions')).rows[0];
      assert.equal(row.previous_status, 'AVAILABLE'); assert.equal(row.new_status, 'CHARGING');
      assert.equal(row.previous_observed_at.toISOString(), '2026-10-10T10:01:00.000Z');
      assert.equal(row.new_observed_at.toISOString(), '2026-10-10T10:02:00.000Z');
      assert.equal(row.source_last_updated_text, '2026-10-09T17:21:50'); assert.equal(row.source_last_updated_at, null);
    });
    await t.test('duplicate public EVSE IDs stay distinct; connector IDs are EVSE scoped', async () => {
      const f = structuredClone(changed); const second = structuredClone(f.data[0].evses[0]); second.uid = 536;
      f.data[0].evses.push(second);
      await ingest(snapshot(4, f));
      assert.deepEqual(await counts(), { locations: 1, evses: 2, connectors: 2, transitions: 1 });
    });
    await t.test('omissions retain stations; stale observations cannot overwrite current state', async () => {
      await ingest(parseLocations({ ...fixture, data: [] }, '2026-10-10T10:05:00Z'));
      assert.equal((await counts()).evses, 2);
      const id = await beginPoll(db); await assert.rejects(publish(db, id, snapshot(0), evidence()), /Stale/);
      assert.equal((await db.query('select current_status from charging_evses where uid=\'535\'')).rows[0].current_status, 'CHARGING');
    });
    await t.test('failed and incomplete polling preserve last good state and record failure', async () => {
      const before = await counts();
      for (const partial of [false, true]) {
        await assert.rejects(collect(db, async e => { if (partial) e.pages.push({ offset: 0, limit: 1000, returned: 1, total: '1', link: null }); throw new Error('source failed'); }));
        const row = (await db.query("select * from source_poll_runs order by started_at desc limit 1")).rows[0];
        assert.equal(row.outcome, 'FAILURE'); assert.equal(row.completeness, partial ? 'PARTIAL' : 'UNKNOWN');
      }
      assert.deepEqual(await counts(), before);
    });
    await t.test('fault after EVSE writes rolls back state and transition together', async () => {
      const before = await counts(), id = await beginPoll(db);
      const originalQuery = db.query;
      db.query = function(sql, ...args) {
        if (typeof sql === 'string' && sql.startsWith('insert into charging_connectors')) throw new Error('interrupted');
        return originalQuery.call(this, sql, ...args);
      };
      try { await assert.rejects(publish(db, id, snapshot(6), evidence()), /interrupted/); }
      finally { db.query = originalQuery; }
      assert.deepEqual(await counts(), before);
      assert.equal((await db.query('select outcome from source_poll_runs where id=$1', [id])).rows[0].outcome, 'RUNNING');
      await failPoll(db, id, evidence(), 'Injected interruption');
    });
    await t.test('hard connection termination rolls back an open ingestion transaction', async () => {
      const other = new pg.Client({ connectionString }); await other.connect();
      other.on('error', () => {});
      const id = await beginPoll(other), before = await counts();
      await other.query('begin'); await other.query("update charging_evses set current_status='AVAILABLE',source_status='AVAILABLE'");
      await db.query('select pg_terminate_backend($1)', [other.processID]);
      await other.end().catch(() => {});
      assert.deepEqual(await counts(), before);
      assert.equal((await db.query('select outcome from source_poll_runs where id=$1', [id])).rows[0].outcome, 'RUNNING');
    });
    await t.test('concurrent collector cannot bypass session source lock', async () => {
      const other = new pg.Client({ connectionString }); await other.connect();
      await db.query("select pg_advisory_lock(hashtextextended('via-lietuva-ocpi',0))");
      try { await assert.rejects(collect(other, async () => snapshot(7)), /Another collector/); }
      finally { await db.query("select pg_advisory_unlock(hashtextextended('via-lietuva-ocpi',0))"); await other.end(); }
    });
    await t.test('original unknown status changes are retained; EVSE moves preserve identity', async () => {
      const f = structuredClone(fixture); f.data[0].id = 259; f.data[0].evses[0].status = 'FUTURE_A';
      const originalId = (await db.query("select id from charging_evses where uid='535'")).rows[0].id;
      assert.equal((await ingest(snapshot(8, f))).transitions, 1);
      f.data[0].evses[0].status = 'FUTURE_B';
      assert.equal((await ingest(snapshot(9, f))).transitions, 1);
      assert.equal((await ingest(snapshot(10, f))).transitions, 0);
      const row = (await db.query("select * from charging_evses where uid='535'")).rows[0];
      assert.equal(row.id, originalId); assert.equal(row.current_status, 'UNKNOWN'); assert.equal(row.source_status, 'FUTURE_B');
      const transition = (await db.query("select * from evse_status_transitions where new_source_status='FUTURE_B'")).rows[0];
      assert.equal(transition.previous_status, 'UNKNOWN'); assert.equal(transition.new_status, 'UNKNOWN');
      assert.equal(transition.previous_source_status, 'FUTURE_A');
    });
  } finally { await db.end(); }
});
