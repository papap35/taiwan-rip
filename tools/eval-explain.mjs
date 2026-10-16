// AI 解說驗收：對 20 個固定網格／縣市實際呼叫 Claude，檢查輸出（數字、地址、示範提醒、格式）並印出全文供人工檢視。
// 用法：ANTHROPIC_API_KEY=... node tools/eval-explain.mjs [--out report.md]
// 每次約 20 次呼叫（Opus 5.5 effort low，約 US$0.3）。
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeIncident, TYPE_KEYS } from '../lib/data.ts';
import { analyzeRisk } from '../lib/risk.ts';
import { filterView, effectiveWindow } from '../lib/view.ts';
import { buildCellStats, buildCountyStats } from '../lib/explain/stats.ts';
import { checkExplanation } from '../lib/explain/check.ts';
import { countyBySlug } from '../lib/counties.ts';
import { claudeModel, MODEL } from '../lib/server/explain/model.ts';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('請先設定 ANTHROPIC_API_KEY');
  process.exit(1);
}
const outIdx = process.argv.indexOf('--out');
const out = outIdx > 0 ? process.argv[outIdx + 1] : null;

const json = JSON.parse(await readFile(new URL('../public/data/incidents.json', import.meta.url), 'utf8'));
const { temples } = JSON.parse(await readFile(new URL('../public/data/temples.json', import.meta.url), 'utf8'));
const incidents = json.incidents.map(normalizeIncident).filter(Boolean).sort((a, b) => a.t - b.t);
const isDemo = json.meta?.demo !== false;
const endT = incidents.at(-1).t;

// 固定的 20 個案例：預設畫面各等級的網格（依分數排序取樣）＋近 365 天的網格＋5 個縣市
const cases = [];
for (const windowDays of [90, 365]) {
  const view = { endT, windowDays, types: new Set(TYPE_KEYS) };
  const cells = analyzeRisk(filterView(incidents, view), { endT, windowDays: effectiveWindow(incidents[0].t, endT, windowDays) })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const n = windowDays === 90 ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const c = cells[Math.floor((i * (cells.length - 1)) / (n - 1))];
    cases.push({ label: `網格 ${c.key}（近 ${windowDays} 天）`, stats: buildCellStats(incidents, view, c.key, temples, isDemo) });
  }
}
for (const slug of ['taipei', 'new-taipei', 'taichung', 'kaohsiung', 'hualien']) {
  cases.push({ label: `縣市 ${slug}`, stats: buildCountyStats(incidents, countyBySlug(slug), temples, isDemo) });
}

const model = claudeModel();
const lines = [`# AI 解說驗收（${MODEL}，${new Date().toISOString()}）`, ''];
let passed = 0;
let tokensIn = 0;
let tokensOut = 0;
for (const c of cases) {
  let problems;
  let body = '';
  try {
    const r = await model(c.stats);
    tokensIn += r.inputTokens ?? 0;
    tokensOut += r.outputTokens ?? 0;
    problems = checkExplanation(r.explanation, c.stats);
    const e = r.explanation;
    body = [e.summary, ...e.factors.map((f) => `- ${f}`), '建議：', ...e.advice.map((a) => `- ${a}`), `（${e.caveats}）`].join('\n');
  } catch (err) {
    problems = [`呼叫失敗：${err.message}`];
  }
  if (!problems.length) passed++;
  const mark = problems.length ? '✗' : '✓';
  console.log(`${mark} ${c.label}${problems.length ? `\n    ${problems.join('\n    ')}` : ''}`);
  lines.push(`## ${mark} ${c.label}`, '', body, '', ...problems.map((p) => `> ${p}`), '');
}
const cost = (tokensIn * 4 + tokensOut * 20) / 1e6;
const summary = `通過 ${passed}/${cases.length}；輸入 ${tokensIn} tokens、輸出 ${tokensOut} tokens，約 US$${cost.toFixed(3)}（以 Opus 5.5 定價估算）`;
console.log(`\n${summary}`);
lines.splice(1, 0, '', summary);
if (out) await writeFile(out, lines.join('\n'));
process.exit(passed === cases.length ? 0 : 1);
