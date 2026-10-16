// supabase/migrations 的 SQL 在真的 Postgres（PGlite）上執行：建表、去重新增、查詢、匯入鎖
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

let db;
const rec = (id, date, extra = {}) => ({
  id, date, time: '07:30:00', lat: 25.03, lng: 121.56, type: 'traffic_fatal', severity: 4, title: 't', county: '臺北市',
  source: 'https://data.gov.tw/dataset/12818', vehicles: ['機車'], ...extra,
});
const q = async (sql, params) => (await db.query(sql, params)).rows;

before(async () => {
  db = new PGlite();
  // Supabase 內建的角色，本機 Postgres 沒有
  await db.exec('create role anon; create role authenticated;');
  const dir = new URL('../supabase/migrations/', import.meta.url);
  for (const f of (await readdir(dir)).sort()) await db.exec(await readFile(new URL(f, dir), 'utf8'));
});

test('incidents_add dedupes by id', async () => {
  const rows = [rec('a', '2026-01-02'), rec('b', '2026-01-03', { time: '' }), rec('c', '2025-12-31', { source: 'demo', type: 'theft', vehicles: undefined })];
  assert.equal((await q('select incidents_add($1) as n', [JSON.stringify(rows)]))[0].n, 3);
  assert.equal((await q('select incidents_add($1) as n', [JSON.stringify(rows)]))[0].n, 0);
  assert.equal((await q('select count(*)::int as n from incidents'))[0].n, 3);
});

test('incidents_query filters, keeps the newest when limited and returns app records', async () => {
  const all = (await q('select incidents_query() as r'))[0].r;
  assert.equal(all.total, 3);
  assert.equal(all.has_demo, true);
  assert.deepEqual(all.range, ['2025-12-31', '2026-01-03']);
  assert.deepEqual(all.records.map((r) => r.id), ['c', 'a', 'b']);
  assert.deepEqual(all.records[1], { ...rec('a', '2026-01-02') });
  assert.equal(all.records[2].time, undefined);

  const limited = (await q('select incidents_query(p_limit => 2) as r'))[0].r;
  assert.equal(limited.total, 3);
  assert.deepEqual(limited.records.map((r) => r.id), ['a', 'b']);

  const typed = (await q("select incidents_query(p_types => array['theft']) as r"))[0].r;
  assert.deepEqual(typed.records.map((r) => r.id), ['c']);
  const ranged = (await q("select incidents_query(p_from => '2026-01-03') as r"))[0].r;
  assert.deepEqual(ranged.records.map((r) => r.id), ['b']);
  const box = (await q('select incidents_query(p_south => 24, p_west => 120, p_north => 24.5, p_east => 121) as r'))[0].r;
  assert.equal(box.total, 0);
});

test('import_run_start refuses while another import is running', async () => {
  const [run] = await q("select * from import_run_start('a1', 'cron')");
  assert.equal(run.trigger, 'cron');
  await assert.rejects(q("select * from import_run_start('a1', 'admin')"), /already running/);
  await q('update import_runs set finished_at = now() where id = $1', [run.id]);
  assert.equal((await q("select * from import_run_start('a1', 'admin')"))[0].trigger, 'admin');
});

test('tables are not readable by the public roles', async () => {
  const rls = await q("select relname from pg_class where relname in ('incidents','temples','import_runs','ai_explanations','ai_rate_limits') and relrowsecurity");
  assert.equal(rls.length, 5);
  const policies = await q('select count(*)::int as n from pg_policies');
  assert.equal(policies[0].n, 0);
});
