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
  typescript: {
    // `tsc` (`npm run typecheck`, run in CI + pre-commit) is the type gate and
    // excludes remotion/ (Remotion compositions compile only under Remotion's
    // own bundler). Next's build-time type pass ignores that exclude and would
    // wrongly check those files, so we disable it here — app code is still fully
    // typechecked by tsc.
    ignoreBuildErrors: true,
  },
  // NOTE: full security headers/CSP are wired in Phase 2.
};

const withPWA = withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withPWA(nextConfig);
