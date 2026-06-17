import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/src/db/queries/settings";

// PWA manifest. Name/description/icon come from Settings (site_settings) so the
// installed app reflects the operator's branding.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSiteSettings();
  const icons: MetadataRoute.Manifest["icons"] = s.iconStorageKey
    ? [{ src: "/api/v1/media/site-icon", sizes: "any", purpose: "any" }]
    : [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }];
  return {
    name: s.siteTitle,
    short_name: s.siteTitle.slice(0, 12),
    description: s.description ?? undefined,
    start_url: "/",
    display: "standalone",
    background_color: "#121212",
    theme_color: "#121212",
    icons,
  };
}
