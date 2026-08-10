import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache-busting token for the service worker, fixed at build time.
   *
   * sw.js lives in public/ so the bundler never touches it and it can't read
   * env vars — it takes this value from its own registration URL instead
   * (see AppShell). Read here from the plain VERCEL_GIT_COMMIT_SHA, which is
   * always present during a Vercel build, rather than its NEXT_PUBLIC_
   * counterpart, which only exists if "Automatically expose System
   * Environment Variables" happens to be on.
   *
   * The timestamp fallback covers self-hosted builds: a new build should get
   * a new cache either way.
   */
  env: {
    NEXT_PUBLIC_SW_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? `build-${Date.now()}`,
  },
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
