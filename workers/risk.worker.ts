// 在背景執行緒計算危險分級，拖動時間軸時主畫面保持流暢。
import { analyzeRisk, type RiskInput } from '../lib/risk.ts';

interface Request {
  id: number;
  list: RiskInput[];
  endT: number;
  windowDays: number;
}

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, list, endT, windowDays } = e.data;
  self.postMessage({ id, cells: analyzeRisk(list, { endT, windowDays }) });
};
