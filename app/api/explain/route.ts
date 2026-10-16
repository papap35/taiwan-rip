// POST /api/explain：AI 區域解說。金鑰只在伺服器端。
import { NextResponse, type NextRequest } from 'next/server';
import { explain, type ExplainDeps } from '@/lib/server/explain/service.ts';
import { claudeModel, mockModel, MODEL } from '@/lib/server/explain/model.ts';
import { defaultStore } from '@/lib/server/explain/store.ts';
import { loadIncidents, loadTemples } from '@/lib/server/dataset.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deps(): ExplainDeps {
  const mock = process.env.AI_EXPLAIN_MOCK === '1';
  const model = mock ? mockModel : process.env.ANTHROPIC_API_KEY ? claudeModel() : null;
  return {
    store: defaultStore(),
    model,
    modelName: mock ? 'mock' : MODEL,
    data: async () => {
      const [{ meta, list }, temples] = await Promise.all([loadIncidents(), loadTemples()]);
      return { incidents: list, isDemo: meta.demo !== false, temples };
    },
    perIpPerHour: Number(process.env.AI_PER_IP_HOURLY_LIMIT) || 20,
    dailyLimit: Number(process.env.AI_DAILY_LIMIT) || 2000,
    salt: process.env.AI_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'taiwan-rip',
  };
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: NextRequest) {
  let input: unknown;
  try {
    input = await req.json();
  } catch {
    input = null;
  }
  const out = await explain(input, clientIp(req), deps());
  return NextResponse.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store' } });
}

/** 前端用來決定按鈕要不要顯示「尚未啟用」 */
export function GET() {
  const enabled = process.env.AI_EXPLAIN_MOCK === '1' || Boolean(process.env.ANTHROPIC_API_KEY);
  return NextResponse.json({ enabled }, { headers: { 'Cache-Control': 'no-store' } });
}
