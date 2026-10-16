// 伺服器端讀取事件與宮廟（頁面、分享圖、AI 解說共用）。來源見 lib/server/repo。
// 快取：讀檔案或正在建置時，整個程序只讀一次；執行中讀資料庫時每個請求讀一次（React cache），
// 匯入或編輯後重新產生的頁面一定拿到最新資料。
import { cache } from 'react';
import { normalizeIncident, type Incident } from '../data.ts';
import type { TempleRecord } from '../temple-schema.ts';
import { getRepo, type DataMeta } from './repo/index.ts';

type Loaded = { meta: DataMeta; list: Incident[] };

const g = globalThis as typeof globalThis & { __taiwanRipData?: { incidents?: Promise<Loaded>; temples?: Promise<TempleRecord[]> } };
const memo = () => (g.__taiwanRipData ??= {});
const longLived = () => getRepo().kind === 'files' || process.env.NEXT_PHASE === 'phase-production-build';

async function readIncidents(): Promise<Loaded> {
  const { meta, records } = await getRepo().incidents();
  return {
    meta,
    list: records.map(normalizeIncident).filter((d): d is Incident => d !== null).sort((a, b) => a.t - b.t),
  };
}

const perRequestIncidents = cache(readIncidents);
const perRequestTemples = cache(() => getRepo().temples());

function remember<T>(key: 'incidents' | 'temples', load: () => Promise<T>): Promise<T> {
  const m = memo() as Record<string, Promise<T> | undefined>;
  if (!m[key]) {
    m[key] = load();
    m[key]!.catch(() => (m[key] = undefined)); // 失敗不要快取
  }
  return m[key]!;
}

/**
 * maxAgeMs：API 可接受稍舊的資料（例如 AI 解說），跨請求共用快取以減輕資料庫負擔；
 * 頁面不要傳，才能確保重新產生時讀到最新資料。
 */
export function loadIncidents({ maxAgeMs }: { maxAgeMs?: number } = {}): Promise<Loaded> {
  if (longLived()) return remember('incidents', readIncidents);
  if (!maxAgeMs) return perRequestIncidents();
  const m = memo() as { recent?: { at: number; value: Promise<Loaded> } };
  if (!m.recent || Date.now() - m.recent.at > maxAgeMs) {
    const value = readIncidents();
    value.catch(() => (m.recent = undefined));
    m.recent = { at: Date.now(), value };
  }
  return m.recent.value;
}

export function loadTemples(): Promise<TempleRecord[]> {
  return longLived() ? remember('temples', () => getRepo().temples()) : perRequestTemples();
}

export function invalidateData() {
  g.__taiwanRipData = {};
}
