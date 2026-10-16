// 在 Next.js 頁面與 API 中使用的權限檢查
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse, type NextRequest } from 'next/server';
import { checkAdminRequest, SESSION_COOKIE, verifySession } from './session.ts';

/** 後台頁面：未登入就導向登入頁 */
export async function requireAdminPage() {
  if (!verifySession((await cookies()).get(SESSION_COOKIE)?.value)) redirect('/admin/login');
}

/** 管理 API：通過回傳 null，否則回傳錯誤回應 */
export function adminApiGuard(req: NextRequest): NextResponse | null {
  const r = checkAdminRequest({ method: req.method, url: req.url, headers: req.headers, cookie: req.cookies.get(SESSION_COOKIE)?.value });
  return r.ok ? null : NextResponse.json({ error: r.error }, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
