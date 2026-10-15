'use client';

import { useEffect, useRef, useState } from 'react';
import { analyzeRisk, type RiskCell, type RiskInput } from '@/lib/risk.ts';

/** 在 Web Worker 計算分級；不支援 Worker 時改在主執行緒計算。只採用最新一次請求的結果。 */
export function useRiskCells(list: RiskInput[], endT: number, windowDays: number): RiskCell[] {
  const [cells, setCells] = useState<RiskCell[]>([]);
  const worker = useRef<Worker | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    try {
      const w = new Worker(new URL('../workers/risk.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; cells: RiskCell[] }>) => {
        if (e.data.id === latest.current) setCells(e.data.cells);
      };
      worker.current = w;
      return () => {
        w.terminate();
        worker.current = null;
      };
    } catch {
      worker.current = null;
    }
  }, []);

  useEffect(() => {
    const id = ++latest.current;
    // 只傳分級需要的欄位，減少跨執行緒複製
    const slim = list.map(({ t, lat, lng, severity, type }) => ({ t, lat, lng, severity, type }));
    if (worker.current) worker.current.postMessage({ id, list: slim, endT, windowDays });
    else setCells(analyzeRisk(slim, { endT, windowDays }));
  }, [list, endT, windowDays]);

  return cells;
}
