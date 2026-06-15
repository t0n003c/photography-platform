import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/src/lib/seo";
import { getEnv } from "@/src/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/g/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: getEnv().APP_BASE_URL,
  };
}
