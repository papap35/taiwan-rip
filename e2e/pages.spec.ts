import { test, expect, isMobile, noHorizontalScroll } from './fixtures';

test('county index lists all 22 counties and links to detail pages', async ({ page, errors }) => {
  await page.goto('/county');
  await expect(page.getByRole('heading', { level: 1, name: '縣市事件統計' })).toBeVisible();
  const links = page.locator('main a[href^="/county/"]');
  await expect(links).toHaveCount(22);
  await links.filter({ hasText: '臺北市' }).click();
  await expect(page).toHaveURL(/\/county\/taipei$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('臺北市事件統計');
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('county page shows stats, an interactive chart, risk areas and temples', async ({ page, errors }) => {
  await page.goto('/county/taipei');
  await expect(page.getByText('目前為示範資料')).toBeVisible();
  await expect(page.getByText('近 90 天事件')).toBeVisible();

  // 每月趨勢：鍵盤聚焦一根柱子會出現提示框，也有表格檢視
  const firstBar = page.getByRole('group', { name: /每月事件數/ }).locator('rect[tabindex="0"]').first();
  await firstBar.focus();
  await expect(page.getByRole('tooltip')).toContainText('起');
  await page.getByText('以表格檢視').click();
  await expect(page.locator('details table tbody tr')).toHaveCount(24);

  // 風險較高區域連回地圖並定位
  const mapLink = page.getByRole('link', { name: '在地圖上查看這一區' }).first();
  await expect(mapLink).toHaveAttribute('href', /^\/\?lat=.*&z=13$/);

  await expect(page.getByRole('link', { name: '行天宮' })).toHaveAttribute('href', '/temples/taipei-xingtian-temple');
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('temple directory filters and detail page shows unconfirmed fields honestly', async ({ page, errors }) => {
  await page.goto('/temples');
  const cards = page.locator('main ul a[href^="/temples/"]');
  const total = await cards.count();
  await page.getByLabel('只看可收驚').check();
  await expect(cards).not.toHaveCount(total);
  await page.getByLabel('縣市').selectOption('臺北市');
  await expect(cards).toHaveCount(1);
  await cards.first().click();

  await expect(page).toHaveURL(/\/temples\/taipei-xingtian-temple$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('行天宮');
  await expect(page.getByText('尚未確認，請以宮廟公告為準').first()).toBeVisible();
  await expect(page.getByRole('link', { name: '資訊有誤？回報更正' })).toHaveAttribute('href', /github\.com\/papap35\/taiwan-rip\/issues\/new\?title=/);
  await expect(page.getByRole('link', { name: '導航前往' })).toHaveAttribute('href', /google\.com\/maps\/dir/);
  expect(errors).toEqual([]);
});

test('about pages load with emergency numbers', async ({ page, errors }) => {
  for (const [path, heading] of [['/about/method', '分級方法'], ['/about/data', '資料來源'], ['/about/disclaimer', '免責與隱私']]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('a[href="tel:1925"]').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('navigation reaches the content pages from the map', async ({ page, errors }) => {
  await page.goto('/');
  await expect(page.getByTestId('count-label')).toContainText('起事件');
  if (isMobile(page)) await page.getByRole('button', { name: '開啟設定面板' }).click();
  await page.getByRole('link', { name: '縣市統計' }).first().click();
  await expect(page).toHaveURL(/\/county$/);
  await page.getByRole('link', { name: '地圖', exact: true }).click();
  await expect(page.getByTestId('count-label')).toContainText('起事件');
  expect(errors).toEqual([]);
});

test('share previews, sitemap, robots and manifest are served', async ({ page, request }) => {
  test.skip(isMobile(page), 'server responses only need one run');
  await page.goto('/county/kaohsiung');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/county\/kaohsiung\/opengraph-image/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /高雄市事件統計/);
  const img = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(img.headers()['content-type']).toBe('image/png');
  const png = await img.body();
  expect(png.readUInt32BE(16)).toBe(1200); // PNG IHDR 寬
  expect(png.readUInt32BE(20)).toBe(630); // PNG IHDR 高

  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap.match(/\/county\/[a-z-]+</g)).toHaveLength(22);
  expect(sitemap).toContain('/temples/taipei-xingtian-temple');
  expect(await (await request.get('/robots.txt')).text()).toContain('Sitemap:');

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toContain('512x512');
  expect((await request.get('/icons/icon-512.png')).ok()).toBe(true);
  expect((await request.get('/brand/logo-mark.svg')).ok()).toBe(true);
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('after one visit the map and data load offline with a notice', async ({ page, context }) => {
    test.skip(isMobile(page), 'one run is enough');
    await page.goto('/');
    await expect(page.getByTestId('count-label')).toContainText('起事件');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // 讓頁面受 service worker 控制，順便快取目前頁面
    await expect(page.getByTestId('count-label')).toContainText('起事件');
    const online = await page.getByTestId('count-label').textContent();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('離線中：顯示最後一次載入的資料')).toBeVisible();
    await expect(page.getByTestId('count-label')).toHaveText(online!);
    await context.setOffline(false);
  });
});
