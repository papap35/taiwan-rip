// AI 回覆的檢查：只能出現輸入裡有的數字，不能出現門牌地址。未通過就不採用。
import { allowedNumbers, type ExplainStats } from './stats.ts';
import type { Explanation } from './schema.ts';

const ADDRESS = /\d+\s*(號|巷|弄|樓)|[路街]\s*\d+\s*段/;

export function checkExplanation(e: Explanation, stats: ExplainStats): string[] {
  const problems: string[] = [];
  const allowed = allowedNumbers(stats);
  const texts = [e.summary, ...e.factors, ...e.advice, e.caveats];
  for (const t of texts) {
    for (const m of t.match(/\d+(?:\.\d+)?/g) ?? []) {
      if (!allowed.has(String(Number(m)))) problems.push(`出現輸入沒有的數字 ${m}：「${t}」`);
    }
    if (ADDRESS.test(t)) problems.push(`疑似門牌地址：「${t}」`);
  }
  if (stats.isDemo && !texts.some((t) => t.includes('示範'))) problems.push('示範資料卻沒有提醒');
  return problems;
}
