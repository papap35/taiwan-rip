import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDemo } from '../tools/generate-demo-data.mjs';
import { normalizeIncident } from '../lib/data.ts';
import { analyzeRisk } from '../lib/risk.ts';
import { COUNTIES, normalizeCounty } from '../lib/counties.ts';
import { countyStats, riskCellsByCounty, latestTime, MAP_DEFAULT_WINDOW } from '../lib/county-stats.ts';

const DAY = 86400000;
const all = generateDemo().incidents.map(normalizeIncident);
const latest = latestTime(all);

test('normalizeCounty accepts common spellings', () => {
  assert.equal(normalizeCounty('台北市'), '臺北市');
  assert.equal(normalizeCounty('臺中市政府警察局'), '臺中市');
  assert.equal(normalizeCounty('新竹縣竹北市'), '新竹縣');
  assert.equal(normalizeCounty('新竹市東區'), '新竹市');
  assert.equal(normalizeCounty('國道'), null);
  assert.equal(normalizeCounty(''), null);
  assert.equal(COUNTIES.length, 22);
  assert.equal(new Set(COUNTIES.map((c) => c.slug)).size, 22);
});

test('county window counts match the map default view (latest date, 90 days, all types)', () => {
  const from = latest - (MAP_DEFAULT_WINDOW - 1) * DAY;
  let sum = 0;
  for (const c of COUNTIES) {
    const s = countyStats(all, c.name, latest);
    const w = s.windows.find((x) => x.days === MAP_DEFAULT_WINDOW);
    const expected = all.filter((d) => normalizeCounty(d.county) === c.name && d.t >= from && d.t <= latest);
    assert.equal(w.count, expected.length, c.name);
    assert.equal(w.fatal, expected.filter((d) => d.severity >= 4).length, c.name);
    sum += w.count;
  }
  assert.equal(sum, all.filter((d) => d.t >= from).length); // 示範資料每筆都有縣市
});

test('year-over-year compares the same window one year earlier', () => {
  const s = countyStats(all, '新北市', latest);
  const w = s.windows.find((x) => x.days === 30);
  const from = latest - 29 * DAY - 365 * DAY;
  const prev = all.filter((d) => d.county === '新北市' && d.t >= from && d.t <= latest - 365 * DAY);
  assert.equal(w.prevCount, prev.length);
});

test('monthly series has 24 months ending at the latest month and adds up', () => {
  const s = countyStats(all, '臺中市', latest);
  assert.equal(s.monthly.length, 24);
  assert.equal(s.monthly.at(-1).month, new Date(latest).toISOString().slice(0, 7));
  const first = Date.parse(`${s.monthly[0].month}-01`);
  const expected = all.filter((d) => d.county === '臺中市' && d.t >= first && d.t <= latest).length;
  assert.equal(s.monthly.reduce((n, m) => n + m.count, 0), expected);
  assert.ok(s.types.every((t, i) => i === 0 || s.types[i - 1].count >= t.count));
});

test('county risk cells are exactly the map default grading, each assigned once', () => {
  const byCounty = riskCellsByCounty(all, latest);
  const assigned = [...byCounty.values()].flat();
  const from = latest - (MAP_DEFAULT_WINDOW - 1) * DAY;
  const map = analyzeRisk(all.filter((d) => d.t >= from), { endT: latest, windowDays: MAP_DEFAULT_WINDOW });
  assert.equal(assigned.length, map.length);
  const level = new Map(map.map((c) => [c.key, c.level]));
  for (const c of assigned) assert.equal(c.level, level.get(c.key));
  for (const list of byCounty.values()) {
    assert.ok(list.every((c, i) => i === 0 || list[i - 1].level > c.level || (list[i - 1].level === c.level && list[i - 1].score >= c.score)));
  }
});
