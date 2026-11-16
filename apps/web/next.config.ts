import type { NextConfig } from 'next';

const isStaticExport =
  process.env.CF_PAGES === '1' || process.env.STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(isStaticExport
    ? {
        output: 'export' as const,
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          if (process.env.NODE_ENV === 'development') {
            return [
              {
                source: '/api/:path*',
                destination: process.env.DEV_API_PROXY || 'http://127.0.0.1:4005/api/:path*',
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
      }),
};

export default nextConfig;
