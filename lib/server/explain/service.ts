// AI 區域解說的流程：驗證請求 → 伺服器重新計算統計 → 快取 → 用量限制 → 呼叫模型 → 檢查輸出。
// 任何一步失敗都回傳統計摘要（template），不讓使用者看到錯誤堆疊。
import { createHash } from 'node:crypto';
import { ExplainRequest, type ExplainResponse } from '../../explain/schema.ts';
import { buildCellStats, buildCountyStats, type ExplainStats } from '../../explain/stats.ts';
import { checkExplanation } from '../../explain/check.ts';
import { templateExplanation } from '../../explain/template.ts';
import { PROMPT_VERSION } from '../../explain/prompt.ts';
import { countyBySlug } from '../../counties.ts';
import type { Incident } from '../../data.ts';
import type { ExplainModel } from './model.ts';
import type { ExplainStore } from './store.ts';

export interface ExplainDeps {
  store: ExplainStore;
  /** null = 未設定 ANTHROPIC_API_KEY，功能未啟用 */
  model: ExplainModel | null;
  modelName: string;
  data: () => Promise<{ incidents: Incident[]; isDemo: boolean; temples: { name: string; lat: number; lng: number; shoujing?: boolean; county?: string }[] }>;
  perIpPerHour: number;
  dailyLimit: number;
  salt: string;
  now?: () => Date;
  log?: (msg: string) => void;
}

export type ErrorCode = 'bad-request' | 'not-found' | 'disabled' | 'ip-limit' | 'daily-limit';

export type ExplainOutcome =
  | { status: 200; body: ExplainResponse }
  | { status: 400 | 404 | 429 | 503; body: { error: string; code: ErrorCode } };

const ERRORS: Record<ErrorCode, [400 | 404 | 429 | 503, string]> = {
  'bad-request': [400, '請求格式不正確'],
  'not-found': [404, '目前的篩選條件下，這一區沒有事件'],
  disabled: [503, 'AI 解說尚未啟用'],
  'ip-limit': [429, '查詢太頻繁，請一小時後再試'],
  'daily-limit': [429, '今日 AI 解說額度已用完，請明天再試'],
};

const fail = (code: ErrorCode): ExplainOutcome => {
  const [status, error] = ERRORS[code];
  return { status, body: { error, code } } as ExplainOutcome;
};

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function scopeOf(s: ExplainStats): string {
  return s.kind === 'cell'
    ? `約 4 公里網格（中心 ${s.center.lat}, ${s.center.lng}），${s.period.from} 至 ${s.period.to}`
    : `${s.county}，資料截至 ${s.asOf}`;
}

export async function explain(input: unknown, ip: string, deps: ExplainDeps): Promise<ExplainOutcome> {
  const log = deps.log ?? ((m) => console.warn(`[explain] ${m}`));
  const now = deps.now?.() ?? new Date();
  const req = ExplainRequest.safeParse(input);
  if (!req.success) return fail('bad-request');
  if (!deps.model) return fail('disabled');

  const { incidents, isDemo, temples } = await deps.data();
  let stats: ExplainStats | null;
  if (req.data.kind === 'cell') {
    const first = incidents[0]?.t ?? 0;
    const last = incidents.at(-1)?.t ?? 0;
    const endT = Math.min(last, Math.max(first, Date.parse(req.data.end)));
    if (!Number.isFinite(endT)) return fail('bad-request');
    stats = buildCellStats(incidents, { endT, windowDays: req.data.window, types: new Set(req.data.types) }, req.data.key, temples, isDemo);
  } else {
    stats = buildCountyStats(incidents, countyBySlug(req.data.slug)!, temples, isDemo);
  }
  if (!stats) return fail('not-found');

  // 快取鍵用「實際送給模型的統計數字」：資料更新後數字變了，自然就是新的鍵
  const cacheKey = sha(JSON.stringify([PROMPT_VERSION, deps.modelName, stats]));
  const scope = scopeOf(stats);
  const template = (): ExplainOutcome => ({
    status: 200,
    body: { source: 'template', explanation: templateExplanation(stats), scope, generatedAt: now.toISOString() },
  });

  try {
    const cached = await deps.store.get(cacheKey);
    if (cached) return { status: 200, body: { ...cached, source: 'cache' } };
  } catch (err) {
    log(`快取讀取失敗：${(err as Error).message}`);
  }

  try {
    // IP 只存雜湊；先檢查個人上限，避免單一來源耗光全站額度
    if (!(await deps.store.hit(`ip:${sha(deps.salt + ip).slice(0, 32)}`, deps.perIpPerHour, 3600))) return fail('ip-limit');
    if (!(await deps.store.hit(`global:${now.toISOString().slice(0, 10)}`, deps.dailyLimit, 86400))) return fail('daily-limit');
  } catch (err) {
    log(`用量計數失敗，改用統計摘要：${(err as Error).message}`);
    return template();
  }

  let result;
  try {
    result = await deps.model(stats);
  } catch (err) {
    log(`模型呼叫失敗：${(err as Error).message}`);
    return template();
  }
  const problems = checkExplanation(result.explanation, stats);
  if (problems.length) {
    log(`輸出未通過檢查：${problems.join('；')}`);
    return template();
  }

  const body: ExplainResponse = { source: 'ai', explanation: result.explanation, scope, model: result.model, generatedAt: now.toISOString() };
  try {
    await deps.store.put(cacheKey, body, { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  } catch (err) {
    log(`快取寫入失敗：${(err as Error).message}`);
  }
  return { status: 200, body };
}
