/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repoBasePath = isGithubPages ? '/MMC-SetnSeat' : '';

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.googleusercontent.com https://www.googletagmanager.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.firebaseio.com wss://*.firebaseio.com https://*.googleapis.com https://www.google-analytics.com https://region1.google-analytics.com",
  "frame-src 'self' https://www.openstreetmap.org https://www.google.com https://maps.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  ...(isGithubPages
    ? {
        output: 'export',
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
        trailingSlash: true,
      }
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'Content-Security-Policy', value: cspDirectives },
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                {
                  key: 'Permissions-Policy',
                  value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
                },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
              ],
            },
          ];
        },
      }),
  env: {
    NEXT_PUBLIC_BASE_PATH: repoBasePath,
    NEXT_PUBLIC_STATIC_EXPORT: isGithubPages ? 'true' : 'false',
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
