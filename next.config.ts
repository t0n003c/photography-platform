import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image small (see docker/Dockerfile.web).
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Served image variants come from the StorageProvider (MinIO/S3 by default).
    // Remote patterns are widened in Phase 2 once the media pipeline serves real URLs.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "minio" },
    ],
  },
  // NOTE: full security headers/CSP are wired in Phase 2.
};

const withPWA = withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Do NOT auto-register the service worker. Settings registers it only when an
  // admin opts into PWA push notifications. app/sw.ts intentionally does not
  // precache or runtime-cache pages, so admin code remains network-fresh.
  register: false,
});

export default withPWA(nextConfig);
