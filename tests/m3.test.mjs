// M3：資料存取、A1 匯入（去重）、管理員登入與權限、宮廟表單驗證
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MemoryRepo } from '../lib/server/repo/memory.ts';
import { FileRepo } from '../lib/server/repo/files.ts';
import { ImportBusyError, ReadOnlyError } from '../lib/server/repo/types.ts';
import { importA1 } from '../lib/server/import-a1.ts';
import { checkAdminRequest, checkPassword, createSession, verifySession } from '../lib/server/admin/session.ts';
import { parseTempleInput } from '../lib/server/admin/temple-input.ts';
import { toFeatureCollection, fromFeatures } from '../lib/geojson.ts';
import { seed } from '../tools/db.mjs';

let server;
let base;
let csvHits = 0;
const fixture = await readFile(new URL('./fixtures/a1-realtime-big5.csv', import.meta.url));
// 固定的示範資料（不依賴 public/data 目前是示範還是真實資料）
const DATA = fileURLToPath(new URL('./fixtures/data/', import.meta.url));

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/a1.csv') {
      csvHits++;
      res.writeHead(200, { 'content-type': 'text/csv' });
      return res.end(fixture);
    }
    if (req.url === '/broken.csv') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<html>維護中</html>');
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const emptyRepo = (now) =>
  new MemoryRepo(async () => ({ meta: { name: '', demo: false, range: [] }, records: [], temples: [] }), now);
const quiet = { log: () => {}, fetch: { tries: 1, timeoutMs: 5000 } };

test('import twice: the second run adds nothing and the count stays the same', async () => {
  const repo = emptyRepo();
  let changes = 0;
  const opts = { repo, trigger: 'cron', urls: [`${base}/a1.csv`], onChange: () => changes++, ...quiet };
  const first = await importA1(opts);
  assert.equal(first.error, undefined);
  assert.ok(first.added > 0);
  assert.equal(first.added, first.fetched);
  const count = (await repo.incidents()).total;
  assert.equal(count, first.added);

  const second = await importA1(opts);
  assert.equal(second.added, 0);
  assert.equal(second.fetched, first.fetched);
  assert.equal((await repo.incidents()).total, count);
  assert.equal(changes, 1, 'only a run that added data refreshes the site');
  assert.equal(csvHits, 2);

  const runs = await repo.importRuns();
  assert.deepEqual(runs.map((r) => [r.trigger, r.added]), [['cron', 0], ['cron', first.added]]);
  const { meta } = await repo.incidents();
  assert.equal(meta.demo, false);
  assert.ok(meta.updated);
});

test('a failed download is recorded, notifies the admin and keeps existing data', async () => {
  const repo = emptyRepo();
  await importA1({ repo, trigger: 'admin', urls: [`${base}/a1.csv`], ...quiet });
  const before = (await repo.incidents()).total;
  const mails = [];
  const run = await importA1({ repo, trigger: 'admin', urls: [`${base}/broken.csv`], notify: async (s, t) => mails.push([s, t]), ...quiet });
  assert.match(run.error, /網頁而不是 CSV/);
  assert.ok(run.finishedAt);
  assert.equal(mails.length, 1);
  assert.match(mails[0][1], /broken\.csv/);
  assert.equal((await repo.incidents()).total, before);
});

test('a second import is refused while one is running, until it is stale', async () => {
  let now = new Date('2026-10-16T01:17:00Z');
  const repo = emptyRepo(() => now);
  await repo.startImport('a1', 'cron');
  await assert.rejects(repo.startImport('a1', 'admin'), ImportBusyError);
  now = new Date('2026-10-16T01:40:00Z');
  assert.equal((await repo.startImport('a1', 'admin')).trigger, 'admin');
});

test('file repo is read-only and filters like the database', async () => {
  const repo = new FileRepo(DATA);
  assert.equal(repo.writable, false);
  assert.throws(() => repo.addIncidents([]), ReadOnlyError);
  const all = await repo.incidents();
  assert.ok(all.total > 100);
  assert.equal(all.meta.demo, true);
  const limited = await repo.incidents({ limit: 5 });
  assert.equal(limited.records.length, 5);
  assert.equal(limited.total, all.total);
  assert.deepEqual(limited.records.map((r) => r.id), all.records.slice(-5).map((r) => r.id), 'keeps the newest');
  const theft = await repo.incidents({ types: ['theft'], from: '2026-01-01', bbox: [24.9, 121.4, 25.2, 121.7] });
  assert.ok(theft.records.length > 0);
  assert.ok(theft.records.every((r) => r.type === 'theft' && r.date >= '2026-01-01' && r.lat >= 24.9 && r.lng <= 121.7));
});

test('seed skips demo incidents unless asked', async () => {
  const logs = [];
  const repo = emptyRepo();
  const r = await seed(repo, { dir: DATA, log: (m) => logs.push(m) });
  assert.equal(r.added, 0);
  assert.ok(r.temples > 10);
  assert.match(logs.join(), /示範資料，未寫入/);
  assert.ok((await seed(emptyRepo(), { includeDemo: true, dir: DATA, log: () => {} })).added > 100);
});

test('geojson round trip keeps every field', () => {
  const recs = [{ id: 'a', date: '2026-01-01', lat: 25.1, lng: 121.5, type: 'theft', severity: 1, title: 't', source: 'demo' }];
  const fc = toFeatureCollection(recs, { demo: true });
  assert.deepEqual(fc.features[0].geometry.coordinates, [121.5, 25.1]);
  assert.deepEqual(fromFeatures(fc.features), [{ id: 'a', date: '2026-01-01', type: 'theft', severity: 1, title: 't', source: 'demo', lng: 121.5, lat: 25.1 }]);
});

test('admin sessions: password, signature, expiry', () => {
  const prev = process.env.ADMIN_PASSWORD;
  try {
    process.env.ADMIN_PASSWORD = 'short';
    assert.equal(checkPassword('short'), false, 'passwords under 12 characters disable the admin');
    process.env.ADMIN_PASSWORD = 'correct horse battery';
    assert.equal(checkPassword('correct horse battery'), true);
    assert.equal(checkPassword('wrong'), false);
    assert.equal(checkPassword(undefined), false);

    const now = Date.parse('2026-10-16T00:00:00Z');
    const { value } = createSession(now);
    assert.equal(verifySession(value, now + 1000), true);
    assert.equal(verifySession(value, now + 13 * 3600_000), false, 'expired');
    const [exp, sig] = value.split('.');
    assert.equal(verifySession(`${Number(exp) + 999999}.${sig}`, now), false, 'tampered expiry');
    assert.equal(verifySession('garbage', now), false);
    process.env.ADMIN_PASSWORD = 'a different password';
    assert.equal(verifySession(value, now + 1000), false, 'changing the password logs everyone out');
  } finally {
    if (prev === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prev;
  }
});

test('admin API requests are refused without a valid session or from another site', () => {
  const prev = process.env.ADMIN_PASSWORD;
  const url = 'https://example.tw/api/admin/import';
  const h = (o) => new Headers(o);
  try {
    delete process.env.ADMIN_PASSWORD;
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({ origin: 'https://example.tw' }) }).status, 503);
    process.env.ADMIN_PASSWORD = 'correct horse battery';
    const cookie = createSession().value;
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({ origin: 'https://example.tw' }) }).status, 401);
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({ origin: 'https://example.tw' }), cookie: 'x.y' }).status, 401);
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({ origin: 'https://evil.example' }), cookie }).status, 403);
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({}), cookie }).status, 403);
    assert.equal(checkAdminRequest({ method: 'POST', url, headers: h({ origin: 'https://example.tw' }), cookie }).ok, true);
  } finally {
    if (prev === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = prev;
  }
});

test('temple form input is cleaned and validated with the temples.json rules', () => {
  const ok = parseTempleInput({ id: 'yilan-test', name: ' 測試宮 ', county: '宜蘭縣', lat: '24.75', lng: '121.75', shoujing: true, phone: '', verifiedOn: '2026-10-01' });
  assert.deepEqual(ok.temple, { id: 'yilan-test', name: '測試宮', county: '宜蘭縣', lat: 24.75, lng: 121.75, shoujing: true, verifiedOn: '2026-10-01' });
  const bad = parseTempleInput({ id: 'Bad ID', name: 'x', county: '火星', lat: '10', lng: '121', website: 'http://x', extra: 1 });
  assert.equal(bad.temple, undefined);
  const msg = bad.errors.join('\n');
  assert.match(msg, /^id 只能用/m);
  assert.match(msg, /火星/);
  assert.match(msg, /lat 不在/);
  assert.match(msg, /https/);
  assert.doesNotMatch(msg, /extra/, 'unknown form fields are ignored, not stored');
});
