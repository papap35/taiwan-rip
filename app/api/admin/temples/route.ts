// 後台新增／編輯宮廟。PUT { temple, create? }；create 為 true 時 id 不可重複。
import { NextResponse, type NextRequest } from 'next/server';
import { adminApiGuard } from '@/lib/server/admin/guard.ts';
import { parseTempleInput } from '@/lib/server/admin/temple-input.ts';
import { getRepo, ReadOnlyError } from '@/lib/server/repo/index.ts';
import { refreshSite } from '@/lib/server/refresh.ts';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  const denied = adminApiGuard(req);
  if (denied) return denied;
  const repo = getRepo();
  if (!repo.writable) return NextResponse.json({ error: new ReadOnlyError().message }, { status: 503 });
  const body = await req.json().catch(() => null);
  const { temple, errors } = parseTempleInput(body?.temple);
  if (!temple) return NextResponse.json({ error: errors.join('；'), errors }, { status: 400 });
  const exists = (await repo.temples()).some((t) => t.id === temple.id);
  if (body?.create && exists) return NextResponse.json({ error: `代稱 ${temple.id} 已被使用` }, { status: 409 });
  if (!body?.create && !exists) return NextResponse.json({ error: `找不到 ${temple.id}` }, { status: 404 });
  await repo.saveTemple(temple);
  refreshSite();
  return NextResponse.json({ ok: true, temple });
}
