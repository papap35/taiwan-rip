import { test as base, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const BLANK_STYLE = fileURLToPath(new URL('./fixtures/blank-style.json', import.meta.url));

// 每個測試：底圖換成本機空白樣式（不依賴外部圖磚），並收集主控台錯誤
const test = base.extend<{ errors: string[] }>({
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

const rangeLabel = (p: Page) => p.getByTestId('range-label');
const countLabel = (p: Page) => p.getByTestId('count-label');
const isMobile = (p: Page) => (p.viewportSize()?.width ?? 1000) < 768;

async function openPanelIfMobile(page: Page) {
  if (isMobile(page)) await page.getByRole('button', { name: '開啟設定面板' }).click();
}

/** 地圖畫布中心（扣掉頂列），點這裡會點到網址指定的座標 */
async function mapCenter(page: Page) {
  const box = (await page.locator('main').boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('loads demo data with timeline, risk grid and no errors', async ({ page, errors }) => {
  await page.goto('/');
  await expect(countLabel(page)).toContainText('起事件');
  await expect(page.getByTestId('risk-stats')).toContainText('個有事件的網格');
  await openPanelIfMobile(page);
  await expect(page.getByText('目前為示範資料')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('timeline window and type filters update counts and the URL', async ({ page, errors }) => {
  await page.goto('/');
  await expect(countLabel(page)).toContainText('起事件');
  const before = await countLabel(page).textContent();

  await page.getByLabel('時間窗長度').selectOption('30');
  await page.getByLabel('結束日期').fill('300');
  await expect(page).toHaveURL(/window=30/);
  await expect(page).toHaveURL(/end=\d{4}-\d{2}-\d{2}/);
  await expect(countLabel(page)).not.toHaveText(before!);

  const withTheft = await countLabel(page).textContent();
  await openPanelIfMobile(page);
  await page.getByRole('button', { name: '竊盜' }).click();
  await expect(page.getByRole('button', { name: '竊盜' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page).toHaveURL(/types=/);
  await expect(countLabel(page)).not.toHaveText(withTheft!);
  expect(errors).toEqual([]);
});

test('shared URL restores the same view', async ({ page, errors }) => {
  await page.goto('/?end=2025-07-28&window=30&types=traffic_fatal,homicide');
  await expect(rangeLabel(page)).toHaveText('2025-06-29 ～ 2025-07-28');
  await expect(page.getByLabel('時間窗長度')).toHaveValue('30');
  await openPanelIfMobile(page);
  await expect(page.getByRole('button', { name: '竊盜' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '交通事故死亡' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('clicking an incident and a grid cell opens their popups', async ({ page, request, errors }) => {
  const { incidents } = await (await request.get('/data/incidents.json')).json();
  const d = incidents.at(-1); // 預設時間窗內最新的一起
  await page.goto(`/?lat=${d.lat}&lng=${d.lng}&z=16`);
  await expect(countLabel(page)).toContainText('起事件');
  await page.waitForTimeout(1500); // 等地圖繪製完成

  const c = await mapCenter(page);
  await page.mouse.click(c.x, c.y);
  const popup = page.locator('.maplibregl-popup');
  await expect(popup).toContainText(d.title);
  await expect(popup).toContainText('附近可收驚');

  // 同一個 4 公里網格內、旁邊沒有事件點的位置 → 危險分級說明
  await page.locator('.maplibregl-popup-close-button').click();
  await page.mouse.click(c.x + 80, c.y - 120);
  await expect(popup).toContainText('AI 危險分級');
  expect(errors).toEqual([]);
});

test('importing a CSV replaces the demo data', async ({ page, errors }) => {
  await page.goto('/');
  await expect(countLabel(page)).toContainText('起事件');
  await openPanelIfMobile(page);
  page.once('dialog', (dlg) => dlg.accept());
  await page.getByLabel('匯入事件資料檔').setInputFiles({
    name: 'my.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,lat,lng,type,title\n2026-01-10,25.04,121.56,車禍,測試一\n2026-01-12,25.05,121.55,竊盜,測試二\n'),
  });
  await expect(countLabel(page)).toHaveText('2 起事件，其中 1 起死亡／重大');
  await expect(page.getByText('目前為示範資料')).toHaveCount(0);

  await page.getByRole('button', { name: '恢復預設資料' }).click();
  await expect(page.getByText('目前為示範資料')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('mobile panel opens as a bottom sheet and closes on map tap', async ({ page, errors }) => {
  test.skip(!isMobile(page), 'mobile only');
  await page.goto('/');
  await expect(countLabel(page)).toContainText('起事件');
  const toggle = page.getByRole('button', { name: '開啟設定面板' });
  await toggle.click();
  await expect(page.getByRole('button', { name: '關閉設定面板' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { name: '圖層' })).toBeInViewport();

  await page.mouse.click(200, 120); // 抽屜上方的地圖空白處
  await expect(page.getByRole('button', { name: '開啟設定面板' })).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});

test('share copies the current link on desktop', async ({ page, context, errors }) => {
  test.skip(isMobile(page), 'desktop only (mobile uses the system share sheet)');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/?window=30');
  await expect(countLabel(page)).toContainText('起事件');
  await page.getByRole('button', { name: '分享' }).click();
  await expect(page.getByRole('status')).toHaveText('已複製目前畫面的連結');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('window=30');
  expect(errors).toEqual([]);
});
