/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["playwright", "@browserbasehq/sdk"],
  },
};

export default nextConfig;
