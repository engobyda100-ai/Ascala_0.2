/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["playwright", "steel-sdk"],
  },
};

export default nextConfig;
