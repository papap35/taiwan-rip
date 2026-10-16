import { defineConfig } from '@playwright/test';

// 端對端測試：先 `npm run build`，再 `npm run e2e`（會自動啟動 next start）
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
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'npx next start -p 3123',
    url: 'http://localhost:3123',
    reuseExistingServer: !process.env.CI,
    // AI 解說用測試模式（不呼叫 Claude API）
    env: { AI_EXPLAIN_MOCK: '1', AI_PER_IP_HOURLY_LIMIT: '1000' },
    timeout: 60_000,
  },
});
