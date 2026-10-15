// 由 public/brand/ 的 SVG 產生 PWA 與 Apple 圖示 PNG。改了 logo 後重跑：npm run icons
// （瀏覽器分頁用 app/icon.svg，不需要 PNG）
import { readFile, writeFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const svg = await readFile('public/brand/app-icon.svg');
const src = `data:image/svg+xml;base64,${svg.toString('base64')}`;

const outputs = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['app/apple-icon.png', 180],
];
for (const [path, size] of outputs) {
  const png = Buffer.from(
    await new ImageResponse(h('img', { src, width: size, height: size }), { width: size, height: size }).arrayBuffer(),
  );
  await writeFile(path, png);
  console.log(`${path}（${size}px，${(png.length / 1024).toFixed(1)} KB）`);
}
