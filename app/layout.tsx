import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import {
  Playfair_Display,
  Cormorant_Garamond,
  Montserrat,
  Space_Grotesk,
} from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { orgJsonLd } from "@/src/lib/seo";
import { getEnv } from "@/src/lib/env";
import { getSiteSettings } from "@/src/db/queries/settings";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

// Self-hosted display fonts for the page builder's heading/subheading blocks.
// Loaded once here; selectable per block via CSS classes in globals.css.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-cormorant", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const fontVars = `${playfair.variable} ${cormorant.variable} ${montserrat.variable} ${spaceGrotesk.variable}`;

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
  const isPreviewFrame = h.get("x-preview-frame") === "1";
  const settings = await getSiteSettings();
  const orgLogo = settings.iconStorageKey ? "/api/v1/media/site-icon" : undefined;
  return (
    <html lang={settings.locale} className={`${fontVars} no-js`} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js')",
          }}
        />
      </head>
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
          storageKey={isPreviewFrame ? "theme-preview-frame" : "theme"}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
