// 產生 PWA 與網站圖示（紅底白燈籠），輸出到 public/icons/ 與 app/。只有改圖示時才需要重跑：npm run icons
import { writeFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { ImageResponse } from 'next/og.js';

const RED = '#c0392b';
const GOLD = '#f2c14e';

// 圖形放在中央 60% 內，符合 maskable 圖示的安全區
function icon(size) {
  const u = size / 100;
  const bar = (w) => h('div', { style: { width: w * u, height: 6 * u, borderRadius: 3 * u, background: GOLD } });
  return h(
    'div',
    { style: { width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: RED } },
    h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
      bar(22),
      h(
        'div',
        {
          style: {
            width: 46 * u, height: 40 * u, borderRadius: '50%', background: '#fff',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center',
          },
        },
        h('div', { style: { width: 40 * u, height: 2.5 * u, background: RED, opacity: 0.35 } }),
        h('div', { style: { width: 46 * u, height: 2.5 * u, background: RED, opacity: 0.35 } }),
        h('div', { style: { width: 40 * u, height: 2.5 * u, background: RED, opacity: 0.35 } }),
      ),
      bar(22),
      h('div', { style: { width: 3 * u, height: 8 * u, background: GOLD } }),
    ),
  );
}

const outputs = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['app/icon.png', 64],
  ['app/apple-icon.png', 180],
];
for (const [path, size] of outputs) {
  const png = Buffer.from(await new ImageResponse(icon(size), { width: size, height: size }).arrayBuffer());
  await writeFile(path, png);
  console.log(`${path}（${size}px，${(png.length / 1024).toFixed(1)} KB）`);
}
