import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 沒有資料庫時，API 與重新產生的頁面在伺服器端讀取 public/data
  outputFileTracingIncludes: { '/**': ['./public/data/*.json'] },
};

export default nextConfig;
