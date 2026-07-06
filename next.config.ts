import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA-friendly: allow large image uploads (10MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
