// 從政府資料開放平臺自動下載 A1 交通事故資料並更新 public/data/incidents.json。
// GitHub Actions 每週執行（.github/workflows/update-a1.yml），也可在本機手動跑：
//
//   node tools/fetch-a1.mjs                         # 預設資料集 12818（即時 A1）
//   node tools/fetch-a1.mjs --datasets 12818,177136 # 加上年度資料補歷史
//   node tools/fetch-a1.mjs --url https://.../A1.csv # 直接指定下載網址（略過自動查詢）
//
// 選項：
//   --datasets <id,...>  data.gov.tw 資料集編號，會自動查出目前的 CSV 下載網址
//   --url <網址>          直接下載的 CSV（可重複）；也可用環境變數 A1_URLS（逗號或換行分隔）
//   --out <檔案>          輸出檔（預設 public/data/incidents.json）
//   --keep-years <n>     只保留最新資料往前 n 年（預設 3，0 = 全部保留）
//   --dry-run            只顯示結果，不寫檔
//
// 安全檢查：任何檔案下載失敗、轉出 0 筆、或超過一半資料列無法解析（多半是官方改了欄位）
// 都會以錯誤結束且不寫檔，避免把壞資料部署上線。

import { writeFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { readExisting, buildOutput } from './convert-a1.mjs';
import { resolveSources, fetchAndConvert, applyRetention } from '../lib/a1/fetch.ts';

// 下載與檢查邏輯在 lib/a1/fetch.ts（伺服器端每日匯入共用）；這裡保留舊的匯出名稱
export { findCsvUrls, resolveDataset, fetchAndConvert, applyRetention } from '../lib/a1/fetch.ts';

export async function run({ datasets = ['12818'], urls = [], out = 'public/data/incidents.json', keepYears = 3, dryRun = false, log = console.error }) {
  const sources = await resolveSources({ datasets, urls }, log);

  const results = [];
  for (const url of sources) {
    const r = await fetchAndConvert(url);
    log(`${url}：${r.rows} 列 → ${r.incidents.length} 起事故（略過 ${r.skipped} 列${r.nonA1 ? `、非 A1 ${r.nonA1} 列` : ''}）`);
    results.push(r);
  }

  const previous = await readExisting(out);
  const prevIds = new Set(previous.map((d) => d.id));
  const merged = buildOutput([previous, ...results.map((r) => r.incidents)], {
    updated: new Date().toISOString().slice(0, 10),
    sources,
  });
  merged.incidents = applyRetention(merged.incidents, keepYears);
  merged.meta.range = merged.incidents.length ? [merged.incidents[0].date, merged.incidents.at(-1).date] : [];
  if (!merged.incidents.length) throw new Error('合併後沒有任何事故，不寫入檔案');

  const added = merged.incidents.filter((d) => !prevIds.has(d.id)).length;
  const summary = { previous: previous.length, added, total: merged.incidents.length, range: merged.meta.range };
  log(`既有 ${summary.previous} 起，新增 ${added} 起，合計 ${summary.total} 起（${summary.range.join(' ～ ')}）`);
  if (!dryRun) await writeFile(out, JSON.stringify(merged));
  return summary;
}

function parseArgs(argv) {
  const opts = { datasets: ['12818'], urls: [], keepYears: 3 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--datasets') opts.datasets = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--url') opts.urls.push(argv[++i]);
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--keep-years') opts.keepYears = +argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '-h' || a === '--help') {
      console.log('用法：node tools/fetch-a1.mjs [--datasets 12818,...] [--url <csv>]... [--out public/data/incidents.json] [--keep-years 3] [--dry-run]');
      process.exit(0);
    }
    else throw new Error(`未知的參數：${a}`);
  }
  const envUrls = (process.env.A1_URLS || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (!opts.urls.length) opts.urls = envUrls;
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const summary = await run(parseArgs(process.argv.slice(2)));
    // 給 GitHub Actions 用：輸出新增筆數與摘要
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `added=${summary.added}\ntotal=${summary.total}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `### A1 資料更新\n\n| 既有 | 新增 | 合計 | 範圍 |\n| --- | --- | --- | --- |\n| ${summary.previous} | ${summary.added} | ${summary.total} | ${summary.range.join(' ～ ')} |\n`);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
