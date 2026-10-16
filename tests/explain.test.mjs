// AI 區域解說：統計與地圖一致、輸出檢查、快取與用量限制（用假模型，不呼叫 API）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeIncident, TYPE_KEYS } from '../lib/data.ts';
import { analyzeRisk } from '../lib/risk.ts';
import { filterView, effectiveWindow } from '../lib/view.ts';
import { buildCellStats, buildCountyStats } from '../lib/explain/stats.ts';
import { checkExplanation } from '../lib/explain/check.ts';
import { templateExplanation } from '../lib/explain/template.ts';
import { Explanation } from '../lib/explain/schema.ts';
import { countyBySlug } from '../lib/counties.ts';
import { explain } from '../lib/server/explain/service.ts';
import { MemoryStore } from '../lib/server/explain/store.ts';

const json = JSON.parse(await readFile(new URL('../public/data/incidents.json', import.meta.url), 'utf8'));
const incidents = json.incidents.map(normalizeIncident).filter(Boolean).sort((a, b) => a.t - b.t);
const { temples } = JSON.parse(await readFile(new URL('../public/data/temples.json', import.meta.url), 'utf8'));
const endT = incidents.at(-1).t;
const end = new Date(endT).toISOString().slice(0, 10);
const view = { endT, windowDays: 90, types: new Set(TYPE_KEYS) };
const top = analyzeRisk(filterView(incidents, view), { endT, windowDays: effectiveWindow(incidents[0].t, endT, 90) })
  .sort((a, b) => b.score - a.score)[0];

const cellReq = { kind: 'cell', key: top.key, end, window: 90, types: [...TYPE_KEYS] };

function setup(overrides = {}) {
  const calls = [];
  const logs = [];
  const model = async (stats) => {
    calls.push(stats);
    const e = templateExplanation(stats);
    return { explanation: e, model: 'fake', inputTokens: 1, outputTokens: 1 };
  };
  const deps = {
    store: new MemoryStore(),
    model,
    modelName: 'fake',
    data: async () => ({ incidents, isDemo: true, temples }),
    perIpPerHour: 20,
    dailyLimit: 2000,
    salt: 's',
    now: () => new Date('2026-10-16T08:00:00Z'),
    log: (m) => logs.push(m),
    ...overrides,
  };
  return { deps, calls, logs };
}

test('cell stats match what the map shows for the same filter', () => {
  const s = buildCellStats(incidents, view, top.key, temples, true);
  assert.equal(s.incidents, top.count);
  assert.equal(s.fatalOrSerious, top.fatal);
  assert.equal(s.period.to, end);
  assert.equal(s.period.days, 90);
  assert.equal(s.weekendCount + s.weekdayCount, top.count);
  assert.equal(s.byType.reduce((n, t) => n + t.count, 0), top.count);
  assert.ok(s.nearbyShoujingTemples.length > 0);
  // 不帶個別事件的描述或地址
  const text = JSON.stringify(s);
  assert.ok(!/"(desc|address|id)"/.test(text));
  assert.equal(buildCellStats(incidents, view, '1:1', temples, true), null);
});

test('county stats summarise windows and local temples', () => {
  const s = buildCountyStats(incidents, countyBySlug('taipei'), temples, true);
  assert.equal(s.county, '臺北市');
  assert.deepEqual(s.windows.map((w) => w.days), [30, 90, 365]);
  assert.ok(s.shoujingTemples.some((t) => t.name === '行天宮'));
});

test('templates pass the output check and the schema', () => {
  for (const s of [buildCellStats(incidents, view, top.key, temples, true), buildCountyStats(incidents, countyBySlug('hualien'), temples, true)]) {
    const e = templateExplanation(s);
    assert.deepEqual(checkExplanation(e, s), []);
    assert.ok(Explanation.safeParse(e).success);
  }
});

test('output check rejects invented numbers, addresses and a missing demo notice', () => {
  const s = buildCellStats(incidents, view, top.key, temples, true);
  const ok = templateExplanation(s);
  assert.match(checkExplanation({ ...ok, summary: '這一區有 98765 起事件' }, s).join(), /98765/);
  assert.match(checkExplanation({ ...ok, factors: ['中山路 2 段附近'] }, s).join(), /地址/);
  assert.match(checkExplanation({ ...ok, factors: ['某處 12 號'] }, s).join(), /地址/);
  assert.match(checkExplanation({ ...ok, caveats: '僅供參考。' }, s).join(), /示範/);
  assert.deepEqual(checkExplanation({ ...ok, caveats: '僅供參考。' }, { ...s, isDemo: false }), []);
});

test('explain: validates input and reports disabled without a model', async () => {
  const { deps } = setup();
  assert.equal((await explain({ kind: 'cell', key: 'x' }, '1.1.1.1', deps)).status, 400);
  assert.equal((await explain({ kind: 'county', slug: 'atlantis' }, '1.1.1.1', deps)).status, 400);
  assert.equal((await explain({ ...cellReq, key: '1:1' }, '1.1.1.1', deps)).status, 404);
  const off = await explain(cellReq, '1.1.1.1', setup({ model: null }).deps);
  assert.equal(off.status, 503);
  assert.equal(off.body.code, 'disabled');
});

test('explain: caches by stats, and cache hits do not use quota', async () => {
  const { deps, calls } = setup({ perIpPerHour: 1 });
  const a = await explain(cellReq, '1.1.1.1', deps);
  assert.equal(a.status, 200);
  assert.equal(a.body.source, 'ai');
  assert.match(a.body.scope, /約 4 公里網格/);
  const b = await explain(cellReq, '1.1.1.1', deps);
  assert.equal(b.body.source, 'cache');
  assert.deepEqual(b.body.explanation, a.body.explanation);
  assert.equal(calls.length, 1);
  // 不同篩選 → 不同統計 → 新的呼叫，但已超過個人上限
  const c = await explain({ ...cellReq, window: 180 }, '1.1.1.1', deps);
  assert.equal(c.status, 429);
  assert.equal(c.body.code, 'ip-limit');
  assert.equal((await explain({ ...cellReq, window: 180 }, '2.2.2.2', deps)).body.source, 'ai');
});

test('explain: daily global cap', async () => {
  const { deps } = setup({ dailyLimit: 1 });
  assert.equal((await explain({ kind: 'county', slug: 'taipei' }, '1.1.1.1', deps)).status, 200);
  const r = await explain({ kind: 'county', slug: 'yilan' }, '2.2.2.2', deps);
  assert.equal(r.status, 429);
  assert.equal(r.body.code, 'daily-limit');
});

test('explain: model failure or failed check falls back to template, not cached', async () => {
  const bad = setup({
    model: async (stats) => ({ explanation: { ...templateExplanation(stats), summary: '共有 424242 起' }, model: 'fake' }),
  });
  const r = await explain(cellReq, '1.1.1.1', bad.deps);
  assert.equal(r.body.source, 'template');
  assert.match(bad.logs.join(), /424242/);
  assert.equal(await bad.deps.store.get('anything'), null);

  const broken = setup({ model: async () => { throw new Error('boom'); } });
  assert.equal((await explain(cellReq, '1.1.1.1', broken.deps)).body.source, 'template');
  assert.match(broken.logs.join(), /boom/);
});

test('memory store limit window resets', async () => {
  let t = 0;
  const s = new MemoryStore(2, () => t);
  assert.equal(await s.hit('b', 1, 10), true);
  assert.equal(await s.hit('b', 1, 10), false);
  t = 10_000;
  assert.equal(await s.hit('b', 1, 10), true);
  for (const k of ['a', 'b', 'c']) await s.put(k, { k });
  assert.equal(await s.get('a'), null);
});
