import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // AI 解說在伺服器端讀取事件與宮廟資料
  outputFileTracingIncludes: { '/api/explain': ['./public/data/*.json'] },
};

export default nextConfig;
