import { test as base, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const BLANK_STYLE = fileURLToPath(new URL('./fixtures/blank-style.json', import.meta.url));

/** 每個測試：底圖換成本機空白樣式（不依賴外部圖磚），並收集主控台錯誤 */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    await page.route('https://tiles.openfreemap.org/styles/**', (r) => r.fulfill({ path: BLANK_STYLE }));
    await page.route('https://tiles.openfreemap.org/fonts/**', (r) => r.fulfill({ status: 200, body: '' }));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await use(errors);
  },
});

export { expect } from '@playwright/test';
export const isMobile = (p: Page) => (p.viewportSize()?.width ?? 1000) < 768;
export const noHorizontalScroll = (p: Page) =>
  p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
