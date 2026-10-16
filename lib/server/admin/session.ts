// 管理員登入：單一管理員密碼（ADMIN_PASSWORD，至少 12 字元）＋簽章 cookie。
// cookie 內容為「到期時間.簽章」，簽章金鑰由密碼導出，改密碼即讓所有登入失效。M4 加入會員後可改用 Supabase Auth。
import { createHmac } from 'node:crypto';
import { safeEqual } from '../secrets.ts';

export const SESSION_COOKIE = 'admin_session';
export const SESSION_HOURS = 12;
const MIN_PASSWORD = 12;

export function adminConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD ?? '').length >= MIN_PASSWORD;
}

const key = () => `admin-session:${process.env.ADMIN_SESSION_SECRET ?? ''}:${process.env.ADMIN_PASSWORD}`;
const sign = (exp: number) => createHmac('sha256', key()).update(String(exp)).digest('base64url');

export function checkPassword(input: unknown): boolean {
  return adminConfigured() && typeof input === 'string' && safeEqual(input, process.env.ADMIN_PASSWORD!);
}

export function createSession(now = Date.now()): { value: string; maxAge: number } {
  const exp = now + SESSION_HOURS * 3600_000;
  return { value: `${exp}.${sign(exp)}`, maxAge: SESSION_HOURS * 3600 };
}

export function verifySession(value: string | undefined, now = Date.now()): boolean {
  if (!adminConfigured() || !value) return false;
  const [expStr, sig] = value.split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now || !sig) return false;
  return safeEqual(sig, sign(exp));
}

/** 寫入操作要求同源（cookie 已是 SameSite=Strict，這裡再擋一次跨站請求） */
export function sameOrigin(headers: Headers, url: string): boolean {
  const origin = headers.get('origin');
  return origin !== null && origin === new URL(url).origin;
}

export type AdminCheck = { ok: true } | { ok: false; status: 401 | 403 | 503; error: string };

/** 管理 API 共用的權限檢查 */
export function checkAdminRequest(req: { method: string; url: string; headers: Headers; cookie?: string }): AdminCheck {
  if (!adminConfigured()) return { ok: false, status: 503, error: '後台未啟用（未設定 ADMIN_PASSWORD）' };
  if (!verifySession(req.cookie)) return { ok: false, status: 401, error: '請先登入' };
  if (req.method !== 'GET' && !sameOrigin(req.headers, req.url)) return { ok: false, status: 403, error: '拒絕跨站請求' };
  return { ok: true };
}
