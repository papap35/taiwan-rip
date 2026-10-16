import { defineConfig } from '@playwright/test';

// 端對端測試：`npm run e2e` 會用固定的測試資料（tests/fixtures/data）另外建置到 .next-e2e 再啟動，
// 測試結果不受網站實際資料（示範或真實 A1）影響。
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3123',
    // 無 GPU 環境用軟體 WebGL 繪製地圖
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    trace: 'retain-on-failure',
    // service worker 會攔截底圖請求，讓測試的替換失效；離線測試會個別打開
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', testIgnore: /admin\.spec/, use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', testIgnore: /admin\.spec/, use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    // 後台測試會匯入資料、修改宮廟（伺服器用記憶體資料），等地圖與內容頁測完再跑，避免互相影響
    { name: 'admin', testMatch: /admin\.spec/, dependencies: ['desktop', 'mobile'], use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
  webServer: [
    {
      command: 'node tools/copy-maplibre-worker.mjs && npx next build && npx next start -p 3123',
      url: 'http://localhost:3123',
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        DATA_DIR: 'tests/fixtures/data',
        // AI 解說用測試模式（不呼叫 Claude API）
        AI_EXPLAIN_MOCK: '1',
        AI_PER_IP_HOURLY_LIMIT: '1000',
        // 資料放記憶體（以 public/data 為初始內容），後台可寫入；重啟即還原
        DATA_BACKEND: 'memory',
        ADMIN_PASSWORD: 'e2e-admin-password',
        CRON_SECRET: 'e2e-cron-secret',
        A1_URLS: 'http://127.0.0.1:3124/a1.csv',
      },
      timeout: 300_000,
    },
    { command: 'node e2e/a1-server.mjs', url: 'http://127.0.0.1:3124/', reuseExistingServer: !process.env.CI },
  ],
});
