import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: process.env.DEV_API_PROXY || 'https://salan.vietsun.site/api/:path*',
        },
      ];
    }
    return [];
  },
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|icons).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
