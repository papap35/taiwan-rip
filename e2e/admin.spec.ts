import { test, expect } from './fixtures';

const PASSWORD = 'e2e-admin-password';

test('admin pages and APIs refuse visitors who are not logged in', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin/temples/taipei-xingtian-temple');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const origin = { origin: 'http://localhost:3123' };
  expect((await request.post('/api/admin/import', { headers: origin })).status()).toBe(401);
  expect((await request.put('/api/admin/temples', { headers: origin, data: { temple: {} } })).status()).toBe(401);
  expect((await request.put('/api/admin/temples', { headers: { ...origin, cookie: 'admin_session=1.forged' }, data: { temple: {} } })).status()).toBe(401);
  expect((await request.get('/api/cron/import-a1')).status()).toBe(401);
  expect((await request.get('/api/cron/import-a1', { headers: { authorization: 'Bearer wrong' } })).status()).toBe(401);
  // 登入 API 只接受同站請求
  expect((await request.post('/api/admin/login', { headers: { origin: 'https://evil.example' }, data: { password: PASSWORD } })).status()).toBe(403);
});

test('admin logs in, imports A1 twice without duplicates and edits a temple', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('管理員密碼').fill('wrong-password');
  await page.getByRole('button', { name: '登入' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('密碼錯誤');
  await page.getByLabel('管理員密碼').fill(PASSWORD);
  await page.getByRole('button', { name: '登入' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId('backend')).toHaveText('記憶體（測試用）');

  const total = async () => Number((await page.getByTestId('incident-total').textContent())!.replace(/[^\d]/g, ''));
  const before = await total();

  // 第一次匯入新增資料；第二次全部已存在
  const importButton = page.getByRole('button', { name: '立即匯入 A1 資料' });
  await importButton.click();
  await expect(page.locator('main').getByRole('status')).toContainText(/完成：新增 [1-9]\d* 起/);
  const added = Number((await page.locator('main').getByRole('status').textContent())!.match(/新增 (\d+)/)![1]);
  await expect.poll(total).toBe(before + added);
  await importButton.click();
  await expect(page.locator('main').getByRole('status')).toContainText(`完成：新增 0 起，已存在 ${added} 起`);
  await expect.poll(total).toBe(before + added);
  await expect(page.getByTestId('import-runs').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('import-runs')).toContainText('後台手動');

  // 匯入的 A1 事件可從事件 API 查到
  const fc = await (await page.request.get('/api/incidents?types=traffic_fatal&to=2023-12-31')).json();
  expect(fc.type).toBe('FeatureCollection');
  expect(fc.features.length).toBe(added);
  expect(fc.meta.total).toBe(added);

  // 編輯宮廟 → 公開頁面更新
  await page.getByRole('link', { name: '宮廟資料' }).click();
  await page.getByRole('link', { name: '行天宮' }).click();
  await page.getByLabel('收驚時段', { exact: true }).fill('每日 08:00–11:30（e2e）');
  await page.getByLabel(/最後確認日期/).fill('2026-10-01');
  await page.getByRole('button', { name: '儲存' }).click();
  await expect(page.locator('main').getByRole('status')).toContainText('已儲存');
  await expect.poll(async () => {
    await page.goto('/temples/taipei-xingtian-temple');
    return page.locator('main').textContent();
  }).toContain('每日 08:00–11:30（e2e）');

  // 新增宮廟：驗證錯誤會顯示，修正後建立並可公開瀏覽
  await page.goto('/admin/temples/new');
  await page.getByLabel('名稱 *').fill('測試宮');
  await page.getByLabel(/網址代稱/).fill('yilan-e2e-test-temple');
  await page.getByLabel('縣市 *').selectOption('宜蘭縣');
  await page.getByLabel('緯度 *').fill('10');
  await page.getByLabel('經度 *').fill('121.75');
  await page.getByRole('button', { name: '新增宮廟' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('lat 不在台澎金馬範圍');
  await page.getByLabel('緯度 *').fill('24.75');
  await page.getByRole('button', { name: '新增宮廟' }).click();
  await expect(page).toHaveURL(/\/admin\/temples\/yilan-e2e-test-temple$/);
  await page.goto('/temples/yilan-e2e-test-temple');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('測試宮');

  // 每日排程（正確的金鑰）：沒有新資料
  const cron = await page.request.get('/api/cron/import-a1', { headers: { authorization: 'Bearer e2e-cron-secret' } });
  expect(cron.status()).toBe(200);
  expect((await cron.json()).added).toBe(0);

  await page.goto('/admin');
  await page.getByRole('button', { name: '登出' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('incidents API validates parameters', async ({ request }) => {
  expect((await request.get('/api/incidents?bbox=1,2,3')).status()).toBe(400);
  expect((await request.get('/api/incidents?types=ufo')).status()).toBe(400);
  expect((await request.get('/api/incidents?limit=0')).status()).toBe(400);
  const r = await request.get('/api/incidents?limit=3&bbox=24.9,121.4,25.2,121.7');
  expect(r.headers()['cache-control']).toContain('s-maxage');
  const fc = await r.json();
  expect(fc.features).toHaveLength(3);
  expect(fc.meta.truncated).toBe(true);
});
