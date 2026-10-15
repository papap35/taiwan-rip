// 產生分享預覽圖用的中文字型子集（只含 lib/og-text.ts 用到的字），存到 app/fonts/。
// 需要連網（Google Fonts）。只有在 og-text.ts 或縣市名稱改變時才需要重跑：npm run og-font
import { mkdir, writeFile } from 'node:fs/promises';
import { ogCharset } from '../lib/og-text.ts';

const OUT = 'app/fonts';
const chars = ogCharset();

await mkdir(OUT, { recursive: true });
for (const weight of [400, 700]) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${weight}&text=${encodeURIComponent(chars)}`;
  // 用舊瀏覽器的 User-Agent，Google 才會回傳 TrueType（預覽圖產生器不支援 woff2）
  const css = await (await fetch(cssUrl, { headers: { 'User-Agent': 'Mozilla/4.0' } })).text();
  const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/)?.[1];
  if (!url) throw new Error(`找不到 ${weight} 字重的 TrueType 網址：\n${css}`);
  const font = Buffer.from(await (await fetch(url)).arrayBuffer());
  await writeFile(`${OUT}/NotoSansTC-og-${weight}.ttf`, font);
  console.log(`NotoSansTC-og-${weight}.ttf：${(font.length / 1024).toFixed(1)} KB`);
}
await writeFile(`${OUT}/og-charset.txt`, chars);
console.log(`字元數：${[...chars].length}（字型授權：SIL Open Font License 1.1）`);
