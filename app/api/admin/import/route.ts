// 後台「立即匯入」
import { NextResponse, type NextRequest } from 'next/server';
import { adminApiGuard } from '@/lib/server/admin/guard.ts';
import { getRepo, ImportBusyError, ReadOnlyError } from '@/lib/server/repo/index.ts';
import { importA1 } from '@/lib/server/import-a1.ts';
import { refreshSite } from '@/lib/server/refresh.ts';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  const repo = getRepo();
  if (!repo.writable) return NextResponse.json({ error: new ReadOnlyError().message }, { status: 503 });
  try {
    const run = await importA1({ repo, trigger: 'admin', onChange: refreshSite });
    return NextResponse.json(run, { status: run.error ? 502 : 200 });
  } catch (err) {
    if (err instanceof ImportBusyError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
