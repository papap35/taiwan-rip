import { NextResponse, type NextRequest } from 'next/server';
import { sameOrigin, SESSION_COOKIE } from '@/lib/server/admin/session.ts';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers, req.url)) return NextResponse.json({ error: '拒絕跨站請求' }, { status: 403 });
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
