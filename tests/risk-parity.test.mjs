// 新版 lib/risk.ts 必須與遷移前的 js/risk.js 結果完全相同（快照由舊版產生）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateDemo } from '../tools/generate-demo-data.mjs';
import { normalizeIncident } from '../lib/data.ts';
import { analyzeRisk } from '../lib/risk.ts';

const DAY = 86400000;

test('lib/risk.ts reproduces the legacy risk grading exactly', async () => {
  const { scenarios } = JSON.parse(await readFile(new URL('./fixtures/risk-snapshot.json', import.meta.url), 'utf8'));
  const all = generateDemo().incidents.map(normalizeIncident);
  const maxT = Math.max(...all.map((d) => d.t));
  const minT = Math.min(...all.map((d) => d.t));
  assert.equal(scenarios.length, 20);
  for (const s of scenarios) {
    const endT = maxT - s.endOffset * DAY;
    const start = s.windowDays ? endT - (s.windowDays - 1) * DAY : -Infinity;
    const list = all.filter((d) => d.t <= endT && d.t >= start && (!s.types || s.types.includes(d.type)));
    const wd = s.windowDays || Math.max(1, Math.round((endT - minT) / DAY) + 1);
    const cells = analyzeRisk(list, { endT, windowDays: wd }).map((c) => [c.key, c.level, c.count, c.fatal, +c.score.toFixed(9)]);
    assert.deepEqual(cells, s.cells, `scenario end-${s.endOffset}d window ${s.windowDays} types ${s.types}`);
  }
});
