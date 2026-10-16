import { NextResponse, type NextRequest } from 'next/server';
import { adminConfigured, checkPassword, createSession, sameOrigin, SESSION_COOKIE } from '@/lib/server/admin/session.ts';
import { defaultStore } from '@/lib/server/explain/store.ts';
import { sha256 } from '@/lib/server/secrets.ts';

export const runtime = 'nodejs';

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  if (!adminConfigured()) return json({ error: '後台未啟用（未設定 ADMIN_PASSWORD）' }, 503);
  if (!sameOrigin(req.headers, req.url)) return json({ error: '拒絕跨站請求' }, 403);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  // 每個 IP 15 分鐘內最多嘗試 10 次
  if (!(await defaultStore().hit(`login:${sha256(`login:${ip}`).slice(0, 32)}`, 10, 900))) {
    return json({ error: '嘗試次數過多，請 15 分鐘後再試' }, 429);
  }
  const body = await req.json().catch(() => null);
  if (!checkPassword(body?.password)) return json({ error: '密碼錯誤' }, 401);
  const session = createSession();
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production' && !req.url.startsWith('http://localhost'),
    path: '/',
    maxAge: session.maxAge,
  });
  return res;
}
