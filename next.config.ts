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
  // NOTE: Serwist PWA integration and full security headers/CSP are wired in
  // Phase 3 / Phase 2 respectively. Kept out of the Phase 1 scaffold on purpose.
};

export default nextConfig;
