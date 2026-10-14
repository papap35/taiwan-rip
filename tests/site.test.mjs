// 部署前檢查：網站資料檔與頁面引用的檔案都有效。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { normalizeIncident } from '../js/data.js';
import { analyzeRisk, LEVELS } from '../js/risk.js';

const root = new URL('../', import.meta.url);
const readJSON = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));

test('data/incidents.json: every incident is valid', async () => {
  const { meta, incidents } = await readJSON('data/incidents.json');
  assert.equal(typeof meta?.demo, 'boolean', 'meta.demo 必須是 true / false');
  assert.ok(incidents.length > 0, '至少要有一筆事件');
  const ids = new Set();
  incidents.forEach((d, i) => {
    assert.ok(normalizeIncident(d, i), `第 ${i} 筆無效：${JSON.stringify(d)}`);
    assert.ok(!ids.has(d.id), `重複的 id：${d.id}`);
    ids.add(d.id);
  });
});

test('data/temples.json: temples are inside Taiwan and named', async () => {
  const { temples } = await readJSON('data/temples.json');
  assert.ok(temples.length > 0);
  for (const t of temples) {
    assert.ok(t.name, '宮廟需要名稱');
    assert.ok(t.lat > 21.8 && t.lat < 26.5 && t.lng > 118 && t.lng < 122.2, `${t.name} 座標超出範圍`);
    assert.equal(typeof t.shoujing, 'boolean', `${t.name} 缺少 shoujing`);
  }
});

test('risk analysis runs on the shipped data', async () => {
  const { incidents } = await readJSON('data/incidents.json');
  const list = incidents.map(normalizeIncident);
  const endT = Math.max(...list.map((d) => d.t));
  const cells = analyzeRisk(list.filter((d) => d.t > endT - 90 * 86400000), { endT, windowDays: 90 });
  assert.ok(cells.length > 0);
  for (const c of cells) assert.ok(c.level >= 0 && c.level < LEVELS.length);
});

test('index.html only references local files that exist', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(refs.includes('js/app.js') && refs.includes('css/style.css'));
  for (const r of refs) await access(new URL(r, root));
});
