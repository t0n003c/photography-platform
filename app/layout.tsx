import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { JsonLd } from "@/components/seo/json-ld";
import { orgJsonLd } from "@/src/lib/seo";
import { getEnv } from "@/src/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getEnv().APP_BASE_URL),
  title: {
    default: "Photography Platform",
    template: "%s · Photography Platform",
  },
  description:
    "Self-hosted photography portfolio, private client galleries and print store.",
  applicationName: "Photography Platform",
  manifest: "/manifest.webmanifest",
};

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JsonLd data={orgJsonLd()} nonce={nonce} />
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
