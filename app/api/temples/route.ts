// GET /api/temples：精選宮廟（格式同 public/data/temples.json）。CDN 快取 10 分鐘。
import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/server/repo/index.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ temples: await getRepo().temples() }, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' },
  });
}
