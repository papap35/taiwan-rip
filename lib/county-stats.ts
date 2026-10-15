// 縣市頁統計。純函式，建置時在伺服器端計算，也方便測試。

import type { Incident, IncidentType } from './data.ts';
import { analyzeRisk, type RiskCell } from './risk.ts';
import { normalizeCounty } from './counties.ts';

const DAY = 86400000;
/** 與首頁地圖預設相同：最新日期往前 90 天、全部類別 */
export const MAP_DEFAULT_WINDOW = 90;
const CELL_DEG = 0.04; // 與 analyzeRisk 預設網格大小一致

export interface WindowStat {
  days: number;
  count: number;
  fatal: number;
  /** 去年同期（同長度時間窗往前推 365 天） */
  prevCount: number;
  prevFatal: number;
}

export interface CountyStats {
  latest: number;
  windows: WindowStat[];
  /** 最近 24 個月，舊 → 新 */
  monthly: { month: string; count: number; fatal: number }[];
  /** 近 365 天各類別件數，多 → 少 */
  types: { type: IncidentType; count: number }[];
}

export const latestTime = (all: Incident[]) => all.reduce((m, d) => Math.max(m, d.t), 0);

const inCounty = (d: Incident, county: string) => normalizeCounty(d.county) === county;

function countIn(list: Incident[], from: number, to: number) {
  let count = 0;
  let fatal = 0;
  for (const d of list) {
    if (d.t >= from && d.t <= to) {
      count++;
      if (d.severity >= 4) fatal++;
    }
  }
  return { count, fatal };
}

export function countyStats(all: Incident[], county: string, latest = latestTime(all)): CountyStats {
  const list = all.filter((d) => inCounty(d, county));

  const windows = [30, MAP_DEFAULT_WINDOW, 365].map((days) => {
    const from = latest - (days - 1) * DAY;
    const now = countIn(list, from, latest);
    const prev = countIn(list, from - 365 * DAY, latest - 365 * DAY);
    return { days, ...now, prevCount: prev.count, prevFatal: prev.fatal };
  });

  const end = new Date(latest);
  const monthly = Array.from({ length: 24 }, (_, i) => {
    const m = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 23 + i, 1));
    return { month: m.toISOString().slice(0, 7), count: 0, fatal: 0 };
  });
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  for (const d of list) {
    const m = byMonth.get(new Date(d.t).toISOString().slice(0, 7));
    if (m && d.t <= latest) {
      m.count++;
      if (d.severity >= 4) m.fatal++;
    }
  }

  const typeCounts = new Map<IncidentType, number>();
  const yearFrom = latest - 364 * DAY;
  for (const d of list) if (d.t >= yearFrom && d.t <= latest) typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);
  const types = [...typeCounts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  return { latest, windows, monthly, types };
}

export type CountyCell = RiskCell & { lat: number; lng: number };

/**
 * 全國分級（與首頁地圖預設畫面相同），再依網格內多數事件的縣市歸屬到各縣市。
 * 回傳每個縣市依分數由高到低排序的網格。
 */
export function riskCellsByCounty(all: Incident[], latest = latestTime(all)): Map<string, CountyCell[]> {
  const from = latest - (MAP_DEFAULT_WINDOW - 1) * DAY;
  const windowList = all.filter((d) => d.t >= from && d.t <= latest);
  const cells = analyzeRisk(windowList, { endT: latest, windowDays: MAP_DEFAULT_WINDOW });

  const votes = new Map<string, Map<string, number>>();
  for (const d of windowList) {
    const county = normalizeCounty(d.county);
    if (!county) continue;
    const key = `${Math.floor(d.lat / CELL_DEG)}:${Math.floor(d.lng / CELL_DEG)}`;
    const v = votes.get(key) ?? new Map<string, number>();
    v.set(county, (v.get(county) ?? 0) + 1);
    votes.set(key, v);
  }

  const out = new Map<string, CountyCell[]>();
  for (const c of cells) {
    const v = votes.get(c.key);
    if (!v) continue;
    const county = [...v].sort((a, b) => b[1] - a[1])[0][0];
    const list = out.get(county) ?? [];
    list.push({ ...c, lat: (c.south + c.north) / 2, lng: (c.west + c.east) / 2 });
    out.set(county, list);
  }
  for (const list of out.values()) list.sort((a, b) => b.level - a.level || b.score - a.score);
  return out;
}
