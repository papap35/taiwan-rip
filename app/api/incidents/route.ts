// GET /api/incidents?from=YYYY-MM-DD&to=YYYY-MM-DD&bbox=south,west,north,east&types=a,b&limit=N
// 回傳 GeoJSON（含 meta）；超過上限時只回傳最新的部分（meta.total 為符合條件的總數）。CDN 快取 10 分鐘。
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { TYPE_KEYS } from '@/lib/data.ts';
import { toFeatureCollection } from '@/lib/geojson.ts';
import { getRepo, MAX_LIMIT } from '@/lib/server/repo/index.ts';

export const runtime = 'nodejs';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Query = z.object({
  from: date.optional(),
  to: date.optional(),
  bbox: z
    .string()
    .transform((s) => s.split(',').map(Number))
    .refine((a) => a.length === 4 && a.every(Number.isFinite) && a[0] <= a[2] && a[1] <= a[3], 'bbox 應為 south,west,north,east')
    .optional(),
  types: z
    .string()
    .transform((s) => s.split(',').filter(Boolean))
    .refine((a) => a.every((t) => (TYPE_KEYS as string[]).includes(t)), `types 只能是 ${TYPE_KEYS.join(',')}`)
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('；') }, { status: 400 });
  }
  const q = parsed.data;
  const { meta, records, total } = await getRepo().incidents({ ...q, bbox: q.bbox as [number, number, number, number] | undefined });
  return NextResponse.json(toFeatureCollection(records, { ...meta, total, truncated: total > records.length }), {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400' },
  });
}
