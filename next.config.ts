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
  // Do NOT auto-register the service worker. The PWA SW was caching the admin
  // app and serving stale code; sw.ts is now a self-destruct worker that
  // unregisters any previously-installed SW and clears its caches. With
  // register:false it is never re-registered, so the app runs SW-free (always
  // fresh). Re-enable a properly-scoped SW later if offline support is wanted.
  register: false,
});

export default withPWA(nextConfig);
