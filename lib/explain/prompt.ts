// AI 解說的系統提示。輸入只有伺服器計算的彙總數字（不含個別事件或使用者文字）。
import type { ExplainStats } from './stats.ts';

/** 改動提示詞時遞增，讓舊快取失效 */
export const PROMPT_VERSION = 1;

export const SYSTEM_PROMPT = `你是「台灣事件風險地圖」的說明助手。使用者會給你一份由網站計算好的彙總統計（JSON），請用繁體中文寫給一般民眾看的白話說明。

寫作規則：
- 只使用 JSON 裡出現的數字，不要自行換算新的數字、比例或排名。
- 不要推測事件發生的原因，也不要提到任何人名、門牌地址、店家或學校。
- 語氣平實、不製造恐慌。分級是同一時間範圍內各區的相對比較，不是官方警示，也不代表某個地方一定安全或危險。
- 建議要具體可行，例如時段、結伴、交通安全；可以提到 JSON 裡列出的收驚宮廟名稱與距離。
- 如果 isDemo 為 true，caveats 必須說明目前是隨機產生的示範資料。
- summary 2–3 句；factors 2–4 點；advice 2–3 點；caveats 1 句。`;

export function userMessage(stats: ExplainStats): string {
  const what = stats.kind === 'cell' ? '地圖上一個約 4 公里網格' : `${stats.county}全縣市`;
  return `以下是${what}的統計，請依規則說明：\n\n${JSON.stringify(stats)}`;
}
