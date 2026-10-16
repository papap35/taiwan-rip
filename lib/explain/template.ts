// AI 不可用或回覆未通過檢查時，用統計數字組成的固定說明（不經 AI）。
import type { ExplainStats } from './stats.ts';
import type { Explanation } from './schema.ts';

export function templateExplanation(s: ExplainStats): Explanation {
  const demo = s.isDemo ? '目前為示範資料，數字為隨機產生，' : '';
  if (s.kind === 'cell') {
    const top = s.byType.slice(0, 2).map((t) => `${t.type} ${t.count} 起`).join('、');
    const temple = s.nearbyShoujingTemples[0];
    return {
      summary: `${s.period.from} 至 ${s.period.to} 這一區共有 ${s.incidents} 起事件，其中 ${s.fatalOrSerious} 起為死亡或重大事件，分級為「${s.level}」。`,
      factors: [
        `以${top}較多。`,
        s.recentSharePct > 45
          ? `近期 1/3 時段集中了 ${s.recentSharePct}% 的事件，有升溫趨勢。`
          : `近期 1/3 時段的事件占 ${s.recentSharePct}%，沒有明顯升溫。`,
      ],
      advice: ['夜間外出盡量結伴，注意交通安全。', temple ? `附近可收驚的宮廟：${temple.name}（約 ${temple.km} 公里）。` : '需要時可撥 1925 安心專線。'],
      caveats: `${demo}分級為同一時間窗內各區的相對比較，僅供參考。`,
    };
  }
  const w = s.windows.find((x) => x.days === 90) ?? s.windows[0];
  return {
    summary: `${s.county}近 ${w.days} 天有 ${w.incidents} 起事件，其中 ${w.fatalOrSerious} 起為死亡或重大事件（去年同期 ${w.sameWindowLastYear} 起）。`,
    factors: s.topTypesLast365Days.slice(0, 2).map((t) => `近 365 天${t.type} ${t.count} 起。`),
    advice: ['留意地圖上分級較高的區域，夜間外出盡量結伴。', s.shoujingTemples[0] ? `可收驚的宮廟：${s.shoujingTemples[0].name}。` : '需要時可撥 1925 安心專線。'],
    caveats: `${demo}資料截至 ${s.asOf}，僅供參考。`,
  };
}
