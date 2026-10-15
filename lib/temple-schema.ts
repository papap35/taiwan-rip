// public/data/temples.json 的欄位定義與驗證。建置與測試都會跑，格式錯誤就失敗。

import { COUNTIES } from './counties.ts';

export interface TempleRecord {
  /** 網址代稱：小寫英數與連字號，例如 taipei-xingtian-temple */
  id: string;
  name: string;
  county: string;
  lat: number;
  lng: number;
  /** 是否提供收驚 */
  shoujing: boolean;
  deity?: string;
  note?: string;
  address?: string;
  phone?: string;
  website?: string;
  /** 收驚時段（文字，例如「每日 08:00–11:30」） */
  shoujingHours?: string;
  needsBooking?: boolean;
  /** 上述資訊最後確認日期 YYYY-MM-DD */
  verifiedOn?: string;
}

const REQUIRED = ['id', 'name', 'county', 'lat', 'lng', 'shoujing'] as const;
const OPTIONAL_STRINGS = ['deity', 'note', 'address', 'phone', 'website', 'shoujingHours', 'verifiedOn'] as const;
const KNOWN = new Set<string>([...REQUIRED, ...OPTIONAL_STRINGS, 'needsBooking']);
const COUNTY_NAMES = new Set(COUNTIES.map((c) => c.name));

export function validateTemples(json: unknown): { temples: TempleRecord[]; errors: string[] } {
  const errors: string[] = [];
  const list = (json as { temples?: unknown })?.temples;
  if (!Array.isArray(list) || !list.length) return { temples: [], errors: ['缺少 temples 陣列或是空的'] };

  const ids = new Set<string>();
  list.forEach((t: Record<string, unknown>, i) => {
    const where = `第 ${i + 1} 筆（${String(t?.name ?? '未命名')}）`;
    for (const k of REQUIRED) if (t[k] === undefined || t[k] === '') errors.push(`${where}：缺少 ${k}`);
    for (const k of Object.keys(t)) if (!KNOWN.has(k)) errors.push(`${where}：未知欄位 ${k}（拼錯了嗎？）`);

    if (typeof t.id === 'string') {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) errors.push(`${where}：id 只能用小寫英數與連字號`);
      if (ids.has(t.id)) errors.push(`${where}：id 重複 ${t.id}`);
      ids.add(t.id);
    }
    if (typeof t.county === 'string' && !COUNTY_NAMES.has(t.county)) errors.push(`${where}：縣市「${t.county}」不在 22 縣市清單`);
    if (typeof t.lat !== 'number' || t.lat < 21.8 || t.lat > 26.5) errors.push(`${where}：lat 不在台澎金馬範圍`);
    if (typeof t.lng !== 'number' || t.lng < 118 || t.lng > 122.2) errors.push(`${where}：lng 不在台澎金馬範圍`);
    if (t.shoujing !== undefined && typeof t.shoujing !== 'boolean') errors.push(`${where}：shoujing 必須是 true / false`);
    if (t.needsBooking !== undefined && typeof t.needsBooking !== 'boolean') errors.push(`${where}：needsBooking 必須是 true / false`);
    for (const k of OPTIONAL_STRINGS) if (t[k] !== undefined && typeof t[k] !== 'string') errors.push(`${where}：${k} 必須是文字`);
    if (typeof t.website === 'string' && !/^https:\/\//.test(t.website)) errors.push(`${where}：website 必須是 https:// 網址`);
    if (typeof t.verifiedOn === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(t.verifiedOn)) errors.push(`${where}：verifiedOn 格式應為 YYYY-MM-DD`);
  });
  return { temples: errors.length ? [] : (list as TempleRecord[]), errors };
}
