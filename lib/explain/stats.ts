// AI 區域解說的輸入：只有彙總後的數字與類別名稱，不含個別事件、地址或使用者輸入的文字。
// 伺服器端依請求重新計算（不信任瀏覽器傳來的數字）。

import { TYPES, type Incident } from '../data.ts';
import { analyzeRisk, LEVELS } from '../risk.ts';
import { nearestTemples } from '../temples.ts';
import { filterView, effectiveWindow, windowStart, type ViewFilter } from '../view.ts';
import { countyStats as countyNumbers, riskCellsByCounty, MAP_DEFAULT_WINDOW, latestTime } from '../county-stats.ts';
import type { County } from '../counties.ts';

const fmt = (t: number) => new Date(t).toISOString().slice(0, 10);
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

interface TempleLike {
  name: string;
  lat: number;
  lng: number;
  shoujing?: boolean;
  county?: string;
}

export interface CellStats {
  kind: 'cell';
  isDemo: boolean;
  period: { from: string; to: string; days: number };
  level: string;
  /** 約 4 公里網格中心（小數 2 位，避免精確到街道） */
  center: { lat: number; lng: number };
  incidents: number;
  fatalOrSerious: number;
  byType: { type: string; count: number }[];
  /** 時間窗最後 1/3 期間的事件占比（%），大於 33 代表升溫 */
  recentSharePct: number;
  /** 有記錄發生時間的事件，各時段件數 */
  byTimeOfDay?: { period: string; count: number }[];
  weekendCount: number;
  weekdayCount: number;
  nearbyShoujingTemples: { name: string; km: number }[];
}

export interface CountyExplainStats {
  kind: 'county';
  isDemo: boolean;
  county: string;
  asOf: string;
  windows: { days: number; incidents: number; fatalOrSerious: number; sameWindowLastYear: number }[];
  topTypesLast365Days: { type: string; count: number }[];
  /** 依首頁地圖預設畫面（近 90 天）分級，縣市內各等級網格數 */
  gridCellsByLevel: { level: string; cells: number }[];
  shoujingTemples: { name: string; km?: number }[];
}

export type ExplainStats = CellStats | CountyExplainStats;

const TIME_BUCKETS = [
  { period: '深夜 0–6 時', from: 0, to: 6 },
  { period: '上午 6–12 時', from: 6, to: 12 },
  { period: '下午 12–18 時', from: 12, to: 18 },
  { period: '晚上 18–24 時', from: 18, to: 24 },
];

/** 找不到網格回傳 null（例如篩選條件下該格沒有事件） */
export function buildCellStats(
  all: Incident[],
  view: ViewFilter,
  cellKey: string,
  temples: TempleLike[],
  isDemo: boolean,
): CellStats | null {
  const minT = all[0]?.t ?? 0;
  const list = filterView(all, view);
  const days = effectiveWindow(minT, view.endT, view.windowDays);
  const cell = analyzeRisk(list, { endT: view.endT, windowDays: days }).find((c) => c.key === cellKey);
  if (!cell) return null;

  const inCell = list.filter((d) => `${Math.floor(d.lat / 0.04)}:${Math.floor(d.lng / 0.04)}` === cellKey);
  const center = { lat: (cell.south + cell.north) / 2, lng: (cell.west + cell.east) / 2 };
  const timed = inCell.filter((d) => d.time && /^\d{2}:/.test(d.time));
  const weekend = inCell.filter((d) => [0, 6].includes(new Date(d.t).getUTCDay())).length;

  return {
    kind: 'cell',
    isDemo,
    period: { from: fmt(windowStart(minT, view.endT, view.windowDays)), to: fmt(view.endT), days },
    level: LEVELS[cell.level].label,
    center: { lat: +center.lat.toFixed(2), lng: +center.lng.toFixed(2) },
    incidents: cell.count,
    fatalOrSerious: cell.fatal,
    byType: Object.entries(cell.types)
      .sort((a, b) => b[1] - a[1])
      .map(([k, count]) => ({ type: TYPES[k as keyof typeof TYPES]?.label ?? k, count })),
    recentSharePct: Math.round(cell.trend * 100),
    byTimeOfDay: timed.length
      ? TIME_BUCKETS.map((b) => ({
          period: b.period,
          count: timed.filter((d) => {
            const h = Number(d.time!.slice(0, 2));
            return h >= b.from && h < b.to;
          }).length,
        }))
      : undefined,
    weekendCount: weekend,
    weekdayCount: inCell.length - weekend,
    nearbyShoujingTemples: nearestTemples(center, temples.filter((t) => t.shoujing), 2).map((t) => ({
      name: t.name,
      km: Math.round(t.km),
    })),
  };
}

export function buildCountyStats(all: Incident[], county: County, temples: TempleLike[], isDemo: boolean): CountyExplainStats {
  const latest = latestTime(all);
  const s = countyNumbers(all, county.name, latest);
  const cells = riskCellsByCounty(all, latest).get(county.name) ?? [];
  const local = temples.filter((t) => t.shoujing && t.county === county.name).map((t) => ({ name: t.name }));
  return {
    kind: 'county',
    isDemo,
    county: county.name,
    asOf: fmt(latest),
    windows: s.windows.map((w) => ({ days: w.days, incidents: w.count, fatalOrSerious: w.fatal, sameWindowLastYear: w.prevCount })),
    topTypesLast365Days: s.types.slice(0, 4).map((t) => ({ type: TYPES[t.type].label, count: t.count })),
    gridCellsByLevel: LEVELS.map((l, i) => ({ level: l.label, cells: cells.filter((c) => c.level === i).length })),
    shoujingTemples: local.length
      ? local
      : nearestTemples(county, temples.filter((t) => t.shoujing), 2).map((t) => ({ name: t.name, km: Math.round(t.km) })),
  };
}

export { MAP_DEFAULT_WINDOW };

/** 解說裡允許出現的數字：輸入中所有數字（含日期的年月日）＋幾個固定常數 */
export function allowedNumbers(stats: ExplainStats): Set<string> {
  const out = new Set<string>(['1', '3', '4', '24', '110', '119', '1925', String(MAP_DEFAULT_WINDOW)]);
  const add = (n: number | string) => {
    const s = String(n);
    out.add(String(Number(s)));
  };
  const walk = (v: unknown) => {
    if (typeof v === 'number') add(v);
    else if (typeof v === 'string') for (const m of v.match(/\d+(?:\.\d+)?/g) ?? []) add(m);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(stats);
  return out;
}
