// 呼叫 Claude 產生解說。金鑰只在伺服器端（ANTHROPIC_API_KEY），不會送到瀏覽器。
import Anthropic from '@anthropic-ai/sdk';
import { EXPLANATION_JSON_SCHEMA, Explanation } from '../../explain/schema.ts';
import { SYSTEM_PROMPT, userMessage } from '../../explain/prompt.ts';
import { templateExplanation } from '../../explain/template.ts';
import type { ExplainStats } from '../../explain/stats.ts';

export const MODEL = process.env.AI_EXPLAIN_MODEL || 'claude-opus-5-5';

export interface ModelResult {
  explanation: Explanation;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export type ExplainModel = (stats: ExplainStats) => Promise<ModelResult>;

export class ModelUnavailableError extends Error {}

export function claudeModel(client = new Anthropic()): ExplainModel {
  return async (stats) => {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // 安全機制拒答時，由伺服器自動改用建議的備援模型
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage(stats) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EXPLANATION_JSON_SCHEMA } },
    } as unknown as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);

    if (res.stop_reason === 'refusal') throw new ModelUnavailableError('模型拒絕回答');
    if (res.stop_reason === 'max_tokens') throw new ModelUnavailableError('回覆過長被截斷');
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ModelUnavailableError('回覆不是 JSON');
    }
    const parsed = Explanation.safeParse(json);
    if (!parsed.success) throw new ModelUnavailableError(`回覆格式不符：${parsed.error.message}`);
    return {
      explanation: parsed.data,
      model: res.model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  };
}

/** 端對端測試用：不呼叫 API，依統計數字回傳固定內容。只在 AI_EXPLAIN_MOCK=1 時使用，正式環境不要設定。 */
export const mockModel: ExplainModel = async (stats) => {
  const e = templateExplanation(stats);
  return { explanation: { ...e, summary: `（測試模式）${e.summary}` }, model: 'mock' };
};
