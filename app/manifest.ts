import type { MetadataRoute } from "next";

// PWA manifest. Icons + offline shell are completed in Phase 3 (Serwist).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Photography Platform",
    short_name: "Photos",
    description:
      "Self-hosted photography portfolio, private client galleries and print store.",
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
