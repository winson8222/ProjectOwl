import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA-friendly: allow large image uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/transactions/new/scan",
        destination: "/transactions/new",
        permanent: true,
      },
      {
        source: "/transactions/new/manual",
        destination: "/transactions/new",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
