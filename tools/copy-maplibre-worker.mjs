// MapLibre 6 從獨立檔案載入背景 worker，Next.js 打包時不會自動輸出這些檔案。
// 建置與開發前把它們複製到 public/maplibre/（已列入 .gitignore），版本永遠跟 node_modules 一致。
import { cp, mkdir } from 'node:fs/promises';

const SRC = 'node_modules/maplibre-gl/dist';
const OUT = 'public/maplibre';
const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'];

await mkdir(OUT, { recursive: true });
for (const f of FILES) await cp(`${SRC}/${f}`, `${OUT}/${f}`);
console.log(`已複製 MapLibre worker 到 ${OUT}/`);
