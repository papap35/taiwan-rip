// 分享預覽圖（Open Graph）上出現的文字。
// 預覽圖用的中文字型只包含這些字（tools/build-og-font.mjs 依此產生字型子集），
// 新增文字後要重跑 `npm run og-font`，tests/og-font.test.mjs 會檢查有沒有漏字。

import { COUNTIES } from './counties.ts';
import { SITE_NAME } from './site.ts';

export const OG_TEXT = {
  site: SITE_NAME,
  tagline: '時間軸・AI 危險分級・附近收驚宮廟',
  recent: (days: number) => `近 ${days} 天事件`,
  fatal: (n: number) => `死亡／重大 ${n} 起`,
  asOf: (date: string) => `資料截至 ${date}`,
  demo: '示範資料',
  stats: '縣市統計',
};

/** 字型子集要涵蓋的所有字元 */
export function ogCharset(): string {
  const samples = [
    OG_TEXT.site,
    OG_TEXT.tagline,
    OG_TEXT.recent(0),
    OG_TEXT.fatal(0),
    OG_TEXT.asOf('0'),
    OG_TEXT.demo,
    OG_TEXT.stats,
    ...COUNTIES.map((c) => c.name),
  ].join('');
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  return [...new Set(samples + ascii)].sort().join('');
}
