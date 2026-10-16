// 資料庫維護（需要 SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY）：
//
//   node tools/db.mjs seed                          # 把 public/data 的宮廟與真實事件寫入資料庫（示範資料不寫入）
//   node tools/db.mjs seed --include-demo           # 連示範資料也寫入（只在想先看看效果時用）
//   node tools/db.mjs import                        # 立即匯入即時 A1（同每日排程）
//   node tools/db.mjs import --datasets 177136      # 補歷史：匯入年度資料集
//   node tools/db.mjs import --url https://.../a.csv
//
// 先在 Supabase 的 SQL Editor 依序執行 supabase/migrations/*.sql。

import { pathToFileURL } from 'node:url';
import { getRepo } from '../lib/server/repo/index.ts';
import { readIncidentFile, readTempleFile } from '../lib/server/repo/files.ts';
import { importA1 } from '../lib/server/import-a1.ts';

export async function seed(repo, { includeDemo = false, dir, log = console.error } = {}) {
  const temples = await readTempleFile(dir);
  for (const t of temples) await repo.saveTemple(t);
  log(`宮廟：寫入 ${temples.length} 間`);
  const { records } = await readIncidentFile(dir);
  const picked = includeDemo ? records : records.filter((r) => r.source !== 'demo');
  if (records.length && !picked.length) log('public/data/incidents.json 是示範資料，未寫入；請執行 import 匯入真實資料');
  const added = picked.length ? await repo.addIncidents(picked) : 0;
  log(`事件：新增 ${added} 起（已存在 ${picked.length - added} 起）`);
  return { temples: temples.length, added };
}

function parseArgs(argv) {
  const o = { cmd: argv[0], datasets: undefined, urls: [], includeDemo: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--datasets') o.datasets = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--url') o.urls.push(argv[++i]);
    else if (a === '--include-demo') o.includeDemo = true;
    else throw new Error(`未知的參數：${a}`);
  }
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const repo = getRepo();
    if (repo.kind !== 'supabase') throw new Error('請先設定 SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
    if (o.cmd === 'seed') await seed(repo, o);
    else if (o.cmd === 'import') {
      const run = await importA1({ repo, trigger: 'cli', datasets: o.datasets, urls: o.urls.length ? o.urls : undefined, log: console.error, notify: async () => {} });
      if (run.error) throw new Error(run.error);
      console.error(`完成：下載 ${run.fetched} 起，新增 ${run.added} 起。網站頁面會在一天內自動更新。`);
    } else {
      console.error('用法：node tools/db.mjs seed [--include-demo] | import [--datasets 12818,...] [--url <csv>]...');
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
