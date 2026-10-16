import { createHash, timingSafeEqual } from 'node:crypto';

/** 固定時間比較，避免從回應時間猜出密碼或金鑰 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
