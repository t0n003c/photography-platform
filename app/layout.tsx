import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { orgJsonLd } from "@/src/lib/seo";
import { getEnv } from "@/src/lib/env";
import { getSiteSettings } from "@/src/db/queries/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const icon = s.iconStorageKey ? "/api/v1/media/site-icon" : "/icon.svg";
  return {
    metadataBase: new URL(getEnv().APP_BASE_URL),
    title: {
      default: s.siteTitle,
      template: `%s · ${s.siteTitle}`,
    },
    description: s.description ?? undefined,
    applicationName: s.siteTitle,
    manifest: "/manifest.webmanifest",
    icons: { icon },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Per-request CSP nonce (set by middleware) — propagated to inline scripts.
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;
  // Live-design preview forces a theme (admin design editor only).
  const forcedTheme = h.get("x-preview-theme") ?? undefined;
  const settings = await getSiteSettings();
  const orgLogo = settings.iconStorageKey ? "/api/v1/media/site-icon" : undefined;
  return (
    <html lang={settings.locale} suppressHydrationWarning>
      <body>
        <JsonLd
          data={orgJsonLd({
            name: settings.siteTitle,
            description: settings.description ?? undefined,
            logo: orgLogo,
          })}
          nonce={nonce}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
          forcedTheme={forcedTheme}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
