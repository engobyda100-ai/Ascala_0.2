/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@browserbasehq/stagehand",
      "pino",
      "pino-pretty",
      "thread-stream",
    ],
  },
};

export default nextConfig;
