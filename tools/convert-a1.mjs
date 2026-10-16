// 把警政署「A1 類道路交通事故」開放資料 CSV 轉成地圖用的 public/data/incidents.json。
//
// 資料來源：
//   即時交通事故資料(A1類)  https://data.gov.tw/dataset/12818
//   歷史交通事故資料        https://data.gov.tw/dataset/12197
//   各年度傷亡道路交通事故資料（例如 113 年 https://data.gov.tw/dataset/172969）
//
// 用法：
//   node tools/convert-a1.mjs <csv 檔案或網址>... [--out public/data/incidents.json] [--append] [--since 2024-01-01]
//
//   --out     輸出檔（預設 public/data/incidents.json）
//   --append  保留輸出檔內既有的真實資料（示範資料一律丟掉），依 id 去重
//   --since   只保留此日期（含）之後的事故
//
// 支援兩種常見格式（轉換邏輯在 lib/a1/convert.ts）：
//   1. 年度檔：一列一個「當事者」，同一事故會有多列；發生日期 20230101、發生時間 73000（前導 0 被省略）
//   2. 即時檔：一列一個事故；發生時間「112年01月01日 07時30分00秒」，車種以分號串接
// 檔案編碼自動判斷 UTF-8 / Big5。

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseCSV } from '../lib/data.ts';
import { convertRows, decode, buildOutput } from '../lib/a1/convert.ts';

// 轉換邏輯在 lib/a1/convert.ts（伺服器端每日匯入共用）；這裡保留舊的匯出名稱
export { SOURCE_URL, decode, parseDateTime, parseCasualties, guessCounty, convertRows, buildOutput } from '../lib/a1/convert.ts';

export async function readInput(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`下載失敗 ${res.status}：${src}`);
    return decode(new Uint8Array(await res.arrayBuffer()));
  }
  return decode(await readFile(src));
}

/** 讀取既有輸出檔中的真實資料（示範資料一律丟掉）；檔案不存在回傳空陣列 */
export async function readExisting(path) {
  try {
    const prev = JSON.parse(await readFile(path, 'utf8'));
    return (prev.incidents ?? []).filter((d) => d.source !== 'demo');
  } catch {
    return [];
  }
}

async function main(argv) {
  const inputs = [];
  let out = 'public/data/incidents.json';
  let append = false;
  let since;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') out = argv[++i];
    else if (a === '--append') append = true;
    else if (a === '--since') since = argv[++i];
    else if (a === '-h' || a === '--help') help = true;
    else inputs.push(a);
  }
  if (!inputs.length || help) {
    console.error('用法：node tools/convert-a1.mjs <csv 檔案或網址>... [--out public/data/incidents.json] [--append] [--since YYYY-MM-DD]');
    process.exit(help ? 0 : 1);
  }

  const lists = [];
  if (append) {
    const prev = await readExisting(out);
    console.error(`保留既有資料 ${prev.length} 筆`);
    lists.push(prev);
  }

  for (const src of inputs) {
    const { incidents, skipped, nonA1 } = convertRows(parseCSV(await readInput(src)), { since });
    lists.push(incidents);
    console.error(`${src}：轉出 ${incidents.length} 起事故，略過 ${skipped} 列${nonA1 ? `，非 A1 ${nonA1} 列` : ''}`);
  }

  const { meta, incidents } = buildOutput(lists);
  if (!incidents.length) {
    console.error('沒有任何有效事故，未寫入檔案。請確認 CSV 是否含「發生日期／發生時間、經度、緯度」欄位。');
    process.exit(1);
  }
  await writeFile(out, JSON.stringify({ meta, incidents }));
  console.error(`已寫入 ${out}：共 ${incidents.length} 起（${meta.range[0]} ～ ${meta.range[1]}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
