// 地圖畫面的篩選規則（結束日期、時間窗、類別）。前端地圖與伺服器端 AI 解說共用，確保兩邊看到同一批事件。

import type { Incident } from './data.ts';

const DAY = 86400000;

export interface ViewFilter {
  endT: number;
  /** 0 = 全部 */
  windowDays: number;
  types: ReadonlySet<string>;
}

export function filterView(all: Incident[], { endT, windowDays, types }: ViewFilter): Incident[] {
  const start = windowDays ? endT - (windowDays - 1) * DAY : -Infinity;
  return all.filter((d) => d.t <= endT && d.t >= start && types.has(d.type));
}

/** 分級用的時間窗天數；「全部」時用資料起點到結束日期的天數 */
export function effectiveWindow(minT: number, endT: number, windowDays: number): number {
  return windowDays || Math.max(1, Math.round((endT - minT) / DAY) + 1);
}

export function windowStart(minT: number, endT: number, windowDays: number): number {
  return windowDays ? Math.max(endT - (windowDays - 1) * DAY, minT) : minT;
}
