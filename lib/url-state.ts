// 網址參數 ↔ 畫面狀態，讓目前的地圖畫面可以分享。
// 例：/?end=2026-09-30&window=90&types=homicide,traffic_fatal&lat=25.04&lng=121.53&z=12

import { TYPE_KEYS, type IncidentType } from './data.ts';

export const WINDOW_OPTIONS = [7, 30, 90, 180, 365, 0] as const;
export const DEFAULT_WINDOW = 90;

export interface UrlState {
  /** 結束日期 YYYY-MM-DD */
  end?: string;
  /** 時間窗天數，0 = 全部 */
  window?: number;
  types?: IncidentType[];
  view?: { lat: number; lng: number; zoom: number };
}

export function parseUrlState(search: string): UrlState {
  const p = new URLSearchParams(search);
  const out: UrlState = {};

  const end = p.get('end');
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && Number.isFinite(Date.parse(end))) out.end = end;

  const win = Number(p.get('window'));
  if (p.has('window') && (WINDOW_OPTIONS as readonly number[]).includes(win)) out.window = win;

  const types = p.get('types');
  if (types !== null) {
    out.types = types.split(',').filter((t): t is IncidentType => (TYPE_KEYS as string[]).includes(t));
  }

  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  const zoom = Number(p.get('z'));
  if (p.has('lat') && p.has('lng') && p.has('z') && lat > 20 && lat < 27 && lng > 117 && lng < 123 && zoom >= 3 && zoom <= 20) {
    out.view = { lat, lng, zoom };
  }
  return out;
}

/** 只寫入與預設不同的值，網址越短越好分享 */
export function serializeUrlState(s: Required<Omit<UrlState, 'view'>> & Pick<UrlState, 'view'>, latestEnd: string): string {
  const p = new URLSearchParams();
  if (s.end !== latestEnd) p.set('end', s.end);
  if (s.window !== DEFAULT_WINDOW) p.set('window', String(s.window));
  if (s.types.length !== TYPE_KEYS.length) p.set('types', s.types.join(','));
  if (s.view) {
    p.set('lat', s.view.lat.toFixed(4));
    p.set('lng', s.view.lng.toFixed(4));
    p.set('z', s.view.zoom.toFixed(2));
  }
  const q = p.toString();
  return q ? `?${q}` : '';
}
