// 全站設定

export const SITE_NAME = '台灣事件風險地圖';
export const SITE_DESCRIPTION = '台灣死亡事故與社會案件地圖：時間軸瀏覽、AI 區域危險分級、附近收驚宮廟。';
export const REPO_URL = 'https://github.com/papap35/taiwan-rip';

/** 正式網址：優先用 NEXT_PUBLIC_SITE_URL，其次 Vercel 自動提供的正式網域 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL('http://localhost:3000');
}

/** 宮廟資訊更正：開一個預先填好的 GitHub issue（M4 會改成站內回報表單） */
export function templeReportUrl(name: string, id: string) {
  const title = `宮廟資訊更正：${name}`;
  const body = [
    `宮廟：${name}（/temples/${id}）`,
    '',
    '請填寫需要更正的項目（收驚時段、電話、地址、是否歇業等）與資訊來源：',
    '',
  ].join('\n');
  return `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
