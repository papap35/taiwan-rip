// 後台表單送來的宮廟資料 → 驗證後的 TempleRecord（空字串視為未填）
import { validateTemples, type TempleRecord } from '../../temple-schema.ts';

const FIELDS = ['id', 'name', 'county', 'lat', 'lng', 'shoujing', 'deity', 'note', 'address', 'phone', 'website', 'shoujingHours', 'needsBooking', 'verifiedOn'] as const;

export function parseTempleInput(input: unknown): { temple?: TempleRecord; errors: string[] } {
  if (!input || typeof input !== 'object') return { errors: ['格式不正確'] };
  const raw = input as Record<string, unknown>;
  const t: Record<string, unknown> = {};
  for (const k of FIELDS) {
    let v = raw[k];
    if (typeof v === 'string') v = v.trim();
    if (v === '' || v === null || v === undefined) continue;
    if ((k === 'lat' || k === 'lng') && typeof v === 'string') v = Number(v);
    t[k] = v;
  }
  if (t.shoujing === undefined) t.shoujing = false;
  const { temples, errors } = validateTemples({ temples: [t] });
  // 驗證訊息以「第 1 筆（名稱）：」開頭，表單只有一筆，去掉前綴比較好讀
  return errors.length ? { errors: errors.map((e) => e.replace(/^第 1 筆（[^）]*）：/, '')) } : { temple: temples[0], errors: [] };
}
