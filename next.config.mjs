/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true';
const repoBasePath = isGithubPages ? '/MMC-SetnSeat' : '';

const nextConfig = {
  ...(isGithubPages
    ? {
        output: 'export',
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
        trailingSlash: true,
      }
    : {}),
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
