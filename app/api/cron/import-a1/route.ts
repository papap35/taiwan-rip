// Vercel Cron 每天呼叫一次（排程見 vercel.json）。需要資料庫；Vercel 會帶 Authorization: Bearer $CRON_SECRET。
import { NextResponse, type NextRequest } from 'next/server';
import { getRepo, ImportBusyError } from '@/lib/server/repo/index.ts';
import { importA1 } from '@/lib/server/import-a1.ts';
import { refreshSite } from '@/lib/server/refresh.ts';
import { safeEqual } from '@/lib/server/secrets.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: '未設定 CRON_SECRET' }, { status: 503 });
  if (!safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const repo = getRepo();
  if (!repo.writable) return NextResponse.json({ error: '匯入需要資料庫（目前讀取 public/data 檔案）', skipped: true }, { status: 503 });
  try {
    const run = await importA1({ repo, trigger: 'cron', onChange: refreshSite });
    return NextResponse.json(run, { status: run.error ? 502 : 200 });
  } catch (err) {
    if (err instanceof ImportBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
