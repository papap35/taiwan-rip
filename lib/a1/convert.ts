// 警政署「A1 類道路交通事故」開放資料 CSV → 事件紀錄。命令列工具（tools/convert-a1.mjs、tools/fetch-a1.mjs）
// 與伺服器端每日匯入（/api/cron/import-a1）共用。
//
// 支援兩種常見格式：
//   1. 年度檔：一列一個「當事者」，同一事故會有多列；發生日期 20230101、發生時間 73000（前導 0 被省略）
//   2. 即時檔：一列一個事故；發生時間「112年01月01日 07時30分00秒」，車種以分號串接
// 檔案編碼自動判斷 UTF-8 / Big5。

import { normalizeIncident } from '../data.ts';

type Row = Record<string, string>;

/** 輸出到 incidents.json／資料庫的一筆 A1 事故 */
export interface A1Record {
  id: string;
  date: string;
  time: string;
  lat: number;
  lng: number;
  type: 'traffic_fatal';
  severity: number;
  county: string;
  place: string;
  deaths: number;
  injuries: number;
  cause?: string;
  vehicles?: string[];
  source: string;
  title: string;
}

type A1Draft = Omit<A1Record, 'title' | 'vehicles'> & { title?: string; vehicles: string[] };

export const SOURCE_URL = 'https://data.gov.tw/dataset/12818';

/** 先試 UTF-8（嚴格），失敗就用 Big5 */
export function decode(buf: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('big5').decode(buf);
  }
}

/** 依多個候選欄位名取值；先比完全相同，再比「包含」 */
function col(row: Row, ...names: string[]): string {
  for (const n of names) {
    const v = row[n];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  for (const n of names) {
    const key = Object.keys(row).find((k) => k.includes(n));
    if (key && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

const pad = (n: number | string, len = 2) => String(n).padStart(len, '0');

/** 回傳 { date: 'YYYY-MM-DD', time: 'HH:MM:SS' | '' }；無法解析回傳 null */
export function parseDateTime(dateRaw: string, timeRaw = ''): { date: string; time: string } | null {
  const s = `${dateRaw} ${timeRaw}`.trim();
  let y: number, m: number, d: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/^(\d{2,3})年\s*(\d{1,2})月\s*(\d{1,2})日/))) {
    [y, m, d] = [+mt[1] + 1911, +mt[2], +mt[3]];
  } else if ((mt = s.match(/^(\d{4})(\d{2})(\d{2})(?!\d)/))) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else if ((mt = s.match(/^(\d{3})(\d{2})(\d{2})(?!\d)/))) {
    [y, m, d] = [+mt[1] + 1911, +mt[2], +mt[3]]; // 民國 1120101
  } else if ((mt = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    [y, m, d] = [+mt[1], +mt[2], +mt[3]];
  } else if ((mt = s.match(/^(\d{2,3})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    [y, m, d] = [+mt[1] + 1911, +mt[2], +mt[3]];
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const rest = s.slice(mt[0].length).trim();

  let time = '';
  let tm: RegExpMatchArray | null;
  if ((tm = rest.match(/(\d{1,2})\s*時\s*(\d{1,2})\s*分(?:\s*(\d{1,2})\s*秒)?/))) {
    time = `${pad(tm[1])}:${pad(tm[2])}:${pad(tm[3] ?? 0)}`;
  } else if ((tm = rest.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/))) {
    time = `${pad(tm[1])}:${tm[2]}:${tm[3] ?? '00'}`;
  } else if (/^\d{1,6}$/.test(rest)) {
    // 官方說明：時分秒共 6 碼，前導 0 會被省略，所以補到 6 碼
    const t = rest.padStart(6, '0');
    time = `${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  }
  if (time && (+time.slice(0, 2) > 23 || +time.slice(3, 5) > 59)) time = '';
  return { date: `${y}-${pad(m)}-${pad(d)}`, time };
}

/** 「死亡1;受傷2」→ { deaths: 1, injuries: 2 } */
export function parseCasualties(s: string): { deaths: number; injuries: number } {
  const deaths = s.match(/死亡\s*(\d+)/);
  const injuries = s.match(/受傷\s*(\d+)/);
  return { deaths: deaths ? +deaths[1] : 0, injuries: injuries ? +injuries[1] : 0 };
}

/** 從處理單位或地點推縣市 */
export function guessCounty(unit: string, place: string): string {
  const u = unit.replace(/台/g, '臺');
  if (/國道/.test(u)) return '國道';
  const m = u.match(/^(.{2}[市縣])/) || place.replace(/台/g, '臺').match(/^(.{2}[市縣])/);
  return m ? m[1] : '';
}

/** 解析後的 CSV 資料列 → 事故陣列（同一事故的多位當事者會合併） */
export function convertRows(rows: Row[], { since }: { since?: string } = {}): { incidents: A1Record[]; skipped: number; nonA1: number } {
  const byKey = new Map<string, A1Draft>();
  let skipped = 0;
  let nonA1 = 0;

  for (const r of rows) {
    // 年度「傷亡道路交通事故」檔混有 A2（受傷）事故，只留 A1
    const category = col(r, '事故類別名稱', '事故類別');
    if (category && !/A1/i.test(category)) {
      nonA1++;
      continue;
    }
    // 年度檔：發生日期 + 發生時間 分兩欄；即時檔：日期時間都在「發生時間」
    const dateRaw = col(r, '發生日期');
    const timeRaw = col(r, '發生時間');
    const dt = dateRaw ? parseDateTime(dateRaw, timeRaw) : parseDateTime(timeRaw);
    const lng = parseFloat(col(r, '經度', 'lng', 'longitude'));
    const lat = parseFloat(col(r, '緯度', 'lat', 'latitude'));
    if (!dt || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++; // 例如檔尾的「資料說明」列
      continue;
    }
    if (since && dt.date < since) continue;

    const key = `${dt.date}|${dt.time}|${lat.toFixed(5)}|${lng.toFixed(5)}`;
    const place = col(r, '發生地點');
    const { deaths, injuries } = parseCasualties(col(r, '死亡受傷人數'));
    const vehicles = col(r, '車種', '當事者區分-類別-子類別名稱-車種', '當事者區分-類別-大類別名稱-車種')
      .split(/[;；]/).map((v) => v.trim()).filter(Boolean);

    let a = byKey.get(key);
    if (!a) {
      a = {
        id: `a1-${dt.date.replace(/-/g, '')}-${dt.time.replace(/:/g, '')}-${lat.toFixed(5)}-${lng.toFixed(5)}`,
        date: dt.date,
        time: dt.time,
        lat: +lat.toFixed(6),
        lng: +lng.toFixed(6),
        type: 'traffic_fatal',
        severity: 4,
        county: guessCounty(col(r, '處理單位名稱警局層', '處理單位'), place),
        place,
        deaths: 0,
        injuries: 0,
        cause: col(r, '肇因研判子類別名稱-主要', '肇因研判大類別名稱-主要', '肇因研判'),
        vehicles: [],
        source: SOURCE_URL,
      };
      byKey.set(key, a);
    }
    // 年度檔每位當事者都重複同一個事故的傷亡數，取最大值而非相加
    a.deaths = Math.max(a.deaths, deaths);
    a.injuries = Math.max(a.injuries, injuries);
    for (const v of vehicles) if (!a.vehicles.includes(v)) a.vehicles.push(v);
  }

  const out: A1Record[] = [];
  for (const a of byKey.values()) {
    a.deaths = Math.max(1, a.deaths); // A1 定義上至少 1 人死亡
    a.severity = a.deaths >= 2 ? 5 : 4; // 多人死亡事故視為最高嚴重度
    a.title = `${a.place || a.county || '交通事故'}・死亡 ${a.deaths} 人${a.injuries ? `、受傷 ${a.injuries} 人` : ''}`;
    const rec: A1Record = { ...a, title: a.title! };
    if (!rec.cause) delete rec.cause;
    if (!rec.vehicles?.length) delete rec.vehicles;
    // 用前端同一套規則驗證（座標需在台澎金馬範圍內）
    if (normalizeIncident(rec, 0)) out.push(rec);
    else skipped++;
  }
  out.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
  return { incidents: out, skipped, nonA1 };
}

/** 合併多批事故（後面的覆蓋前面同 id 的），排序後組成輸出檔內容 */
export function buildOutput(lists: A1Record[][], extraMeta: Record<string, unknown> = {}) {
  const byId = new Map<string, A1Record>();
  for (const list of lists) for (const d of list) byId.set(d.id, d);
  const incidents = [...byId.values()].sort((x, y) => (x.date + (x.time ?? '')).localeCompare(y.date + (y.time ?? '')));
  const meta = {
    name: 'A1 類道路交通事故（警政署開放資料）',
    demo: false,
    source: SOURCE_URL,
    range: incidents.length ? [incidents[0].date, incidents.at(-1)!.date] : [],
    converted: new Date().toISOString().slice(0, 10),
    note: 'A1 為當場或 24 小時內死亡之交通事故；當事者順位與肇因為警方初步研判，非鑑定結果。',
    ...extraMeta,
  };
  return { meta, incidents };
}

