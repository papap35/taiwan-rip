// AI 解說的請求與回覆格式。
import { z } from 'zod';
import { TYPE_KEYS } from '../data.ts';
import { WINDOW_OPTIONS } from '../url-state.ts';
import { COUNTIES } from '../counties.ts';

export const ExplainRequest = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('cell'),
    /** 網格代號，例如 626:3036 */
    key: z.string().regex(/^-?\d{1,5}:-?\d{1,5}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    window: z.number().int().refine((w) => (WINDOW_OPTIONS as readonly number[]).includes(w)),
    types: z.array(z.enum(TYPE_KEYS as [string, ...string[]])).min(1).max(TYPE_KEYS.length),
  }),
  z.object({
    kind: z.literal('county'),
    slug: z.enum(COUNTIES.map((c) => c.slug) as [string, ...string[]]),
  }),
]);
export type ExplainRequest = z.infer<typeof ExplainRequest>;

export const Explanation = z.object({
  summary: z.string().min(1).max(400),
  factors: z.array(z.string().min(1).max(200)).min(1).max(4),
  advice: z.array(z.string().min(1).max(200)).min(1).max(3),
  caveats: z.string().max(300),
});
export type Explanation = z.infer<typeof Explanation>;

/** 給 Claude 結構化輸出用的 JSON Schema（與上面的 zod 定義對應） */
export const EXPLANATION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2–3 句白話摘要' },
    factors: { type: 'array', items: { type: 'string' }, description: '2–4 點，依資料說明這一區的狀況' },
    advice: { type: 'array', items: { type: 'string' }, description: '2–3 點具體、平實的建議' },
    caveats: { type: 'string', description: '1 句資料限制說明' },
  },
  required: ['summary', 'factors', 'advice', 'caveats'],
  additionalProperties: false,
} as const;

export interface ExplainResponse {
  /** ai：剛由 AI 產生；cache：快取；template：AI 不可用或未通過檢查，改用統計摘要 */
  source: 'ai' | 'cache' | 'template';
  explanation: Explanation;
  scope: string;
  model?: string;
  generatedAt: string;
}
