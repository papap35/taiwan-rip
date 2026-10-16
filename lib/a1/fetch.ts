// 從政府資料開放平臺下載 A1 CSV 並轉換。命令列（tools/fetch-a1.mjs）與伺服器端匯入共用。
//
// 安全檢查：下載到網頁、全部無法轉換、或超過一半資料列無法解析（多半是官方改了欄位）都會丟出錯誤，
// 呼叫端據此中止，避免把壞資料寫進網站。

import { parseCSV } from '../data.ts';
import { convertRows, decode, type A1Record } from './convert.ts';

const DAY = 86400000;
/** 即時 A1 交通事故 */
export const DEFAULT_DATASETS = ['12818'];

const apiBase = () => process.env.A1_API_BASE || 'https://data.gov.tw/api/v2/rest/dataset/';

/**
 * 在資料集描述 JSON 中找出 CSV 下載網址。
 * 不依賴固定的欄位結構：遞迴尋找「含網址欄位、且格式標示或副檔名為 CSV」的物件。
 */
export function findCsvUrls(json: unknown): string[] {
  const urls = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const entries = Object.entries(node);
    const format = entries
      .filter(([k, v]) => /format|type|mime/i.test(k) && typeof v === 'string')
      .map(([, v]) => v)
      .join(' ');
    for (const [k, v] of entries) {
      if (typeof v !== 'string' || !/^https?:\/\//.test(v) || !/url|link|download|href/i.test(k)) continue;
      if (/data\.gov\.tw\/dataset\//.test(v)) continue; // 資料集介紹頁，不是檔案
      if (/csv/i.test(format) || /\.csv(\?|$)/i.test(v)) urls.add(v);
    }
    entries.forEach(([, v]) => walk(v));
  };
  walk(json);
  return [...urls];
}

export interface FetchOptions {
  tries?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(url: string, { tries = 3, timeoutMs = 120000 }: FetchOptions = {}): Promise<Uint8Array> {
  let lastErr: Error | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      lastErr = err as Error;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    }
  }
  throw new Error(`下載失敗（已重試 ${tries} 次）：${url}：${lastErr?.message}`);
}

export async function resolveDataset(id: string, opts?: FetchOptions): Promise<string[]> {
  const buf = await fetchWithRetry(`${apiBase()}${encodeURIComponent(id)}`, opts);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new Error(`資料集 ${id} 的描述不是 JSON，平臺 API 可能改版；請改用 --url 或 A1_URLS 直接指定下載網址`);
  }
  const urls = findCsvUrls(json);
  if (!urls.length) throw new Error(`資料集 ${id} 找不到 CSV 下載網址；請改用 --url 或 A1_URLS 直接指定`);
  return urls;
}

export interface Converted {
  url: string;
  rows: number;
  incidents: A1Record[];
  skipped: number;
  nonA1: number;
}

/** 下載並轉換單一 CSV，含格式安全檢查 */
export async function fetchAndConvert(url: string, opts?: FetchOptions): Promise<Converted> {
  const text = decode(await fetchWithRetry(url, opts));
  if (/^\s*</.test(text)) throw new Error(`${url}：下載到的是網頁而不是 CSV，下載網址可能已失效`);
  const rows = parseCSV(text);
  const { incidents, skipped, nonA1 } = convertRows(rows);
  const a1Rows = rows.length - nonA1;
  if (a1Rows > 0 && !incidents.length) {
    throw new Error(`${url}：${rows.length} 列全部無法轉換，官方欄位可能改變（表頭：${Object.keys(rows[0] ?? {}).join(',')}）`);
  }
  // 年度檔一個事故會有多列，所以用「無法解析的列」而非「轉出筆數」判斷
  if (a1Rows > 10 && skipped / a1Rows > 0.5) {
    throw new Error(`${url}：${skipped}/${a1Rows} 列無法解析，超過一半，官方格式可能改變`);
  }
  return { url, rows: rows.length, incidents, skipped, nonA1 };
}

/** 資料集編號或直接指定的網址 → 實際要下載的 CSV 網址 */
export async function resolveSources(
  { datasets = DEFAULT_DATASETS, urls = [] }: { datasets?: string[]; urls?: string[] },
  log: (msg: string) => void = () => {},
  opts?: FetchOptions,
): Promise<string[]> {
  if (urls.length) return urls;
  const out: string[] = [];
  for (const id of datasets) {
    const found = await resolveDataset(id, opts);
    log(`資料集 ${id}：找到 ${found.length} 個 CSV`);
    out.push(...found);
  }
  return out;
}

/** 環境變數 A1_URLS（逗號或換行分隔）指定的下載網址 */
export const envUrls = (): string[] => (process.env.A1_URLS || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

/** 只保留最新事故往前 keepYears 年 */
export function applyRetention<T extends { date: string }>(incidents: T[], keepYears: number): T[] {
  if (!keepYears || !incidents.length) return incidents;
  const latest = Math.max(...incidents.map((d) => Date.parse(d.date)));
  const cutoff = new Date(latest - keepYears * 365 * DAY).toISOString().slice(0, 10);
  return incidents.filter((d) => d.date >= cutoff);
}
