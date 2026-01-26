import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 画像最適化の設定
  images: {
    // 外部ドメインの画像を許可
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
    // 画像の最適化を有効化
    formats: ['image/avif', 'image/webp'],
    // 画像のキャッシュ期間（秒）
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7日間
  },
};

export default nextConfig;
