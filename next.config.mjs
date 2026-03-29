/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@browserbasehq/stagehand"],
  },
};

export default nextConfig;
