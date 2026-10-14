// 把網站需要的靜態檔複製到 dist/，部署時只上傳這些（不含 tools、tests 等）。
import { cp, rm, mkdir } from 'node:fs/promises';

const OUT = 'dist';
const FILES = ['index.html', 'css', 'js', 'data'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT);
for (const f of FILES) await cp(f, `${OUT}/${f}`, { recursive: true });
console.log(`已輸出到 ${OUT}/：${FILES.join('、')}`);
