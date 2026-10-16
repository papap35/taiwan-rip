import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 端對端測試用固定的測試資料另外建置一份（見 playwright.config.ts），不影響一般建置
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // 沒有資料庫時，API 與重新產生的頁面在伺服器端讀取 public/data
  outputFileTracingIncludes: { '/**': ['./public/data/*.json'] },
};

export default nextConfig;
