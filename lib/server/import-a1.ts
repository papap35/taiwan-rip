// A1 匯入：下載 → 轉換（含格式安全檢查）→ 依 id 去重寫入資料庫 → 記錄結果。
// 每日排程（/api/cron/import-a1）、後台「立即匯入」與命令列（tools/db.mjs）共用。
import { DEFAULT_DATASETS, envUrls, fetchAndConvert, resolveSources, type FetchOptions } from '../a1/fetch.ts';
import { notifyAdmin } from './notify.ts';
import type { ImportRun, IncidentRecord, Repo } from './repo/types.ts';

export interface ImportOptions {
  repo: Repo;
  trigger: ImportRun['trigger'];
  datasets?: string[];
  /** 直接指定 CSV 網址；未指定時用環境變數 A1_URLS，再沒有就依資料集編號查詢 */
  urls?: string[];
  fetch?: FetchOptions;
  log?: (msg: string) => void;
  notify?: (subject: string, text: string) => Promise<void>;
  /** 有新增資料時呼叫（讓頁面重新產生） */
  onChange?: () => void | Promise<void>;
}

const datasetsFromEnv = () => (process.env.A1_DATASETS || '').split(',').map((s) => s.trim()).filter(Boolean);

export async function importA1(o: ImportOptions): Promise<ImportRun> {
  const log = o.log ?? ((m: string) => console.log(`[import-a1] ${m}`));
  const datasets = o.datasets ?? (datasetsFromEnv().length ? datasetsFromEnv() : DEFAULT_DATASETS);
  const urls = o.urls ?? envUrls();
  const source = urls.length ? urls.join(',') : `data.gov.tw:${datasets.join(',')}`;
  const run = await o.repo.startImport(source, o.trigger);

  try {
    const sources = await resolveSources({ datasets, urls }, log, o.fetch);
    const records: IncidentRecord[] = [];
    let skipped = 0;
    for (const url of sources) {
      const r = await fetchAndConvert(url, o.fetch);
      log(`${url}：${r.rows} 列 → ${r.incidents.length} 起事故（略過 ${r.skipped} 列）`);
      records.push(...r.incidents);
      skipped += r.skipped;
    }
    const added = await o.repo.addIncidents(records);
    log(`新增 ${added} 起，已存在 ${records.length - added} 起`);
    const done = await o.repo.finishImport(run.id, { fetched: records.length, added, skipped });
    if (added > 0) await o.onChange?.();
    return done;
  } catch (err) {
    const message = (err as Error).message;
    const failed = await o.repo.finishImport(run.id, { error: message });
    await (o.notify ?? notifyAdmin)('A1 資料匯入失敗', `來源：${source}\n觸發：${o.trigger}\n錯誤：${message}\n\n網站仍顯示上一次成功匯入的資料。請到後台 /admin 查看匯入紀錄，或手動重新匯入。`);
    return failed;
  }
}
