// 分享圖字型子集必須涵蓋所有會出現的字，否則圖上會變成方塊
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { ogCharset } from '../lib/og-text.ts';

test('OG font subset covers every character used on share images', async () => {
  const shipped = await readFile(new URL('../app/fonts/og-charset.txt', import.meta.url), 'utf8');
  const missing = [...ogCharset()].filter((c) => !shipped.includes(c));
  assert.deepEqual(missing, [], `字型缺字：${missing.join('')}。請執行 npm run og-font 重新產生字型`);
  for (const w of [400, 700]) {
    const s = await stat(new URL(`../app/fonts/NotoSansTC-og-${w}.ttf`, import.meta.url));
    assert.ok(s.size > 1000);
  }
});
