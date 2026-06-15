import type { Metadata, Viewport } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <JsonLd data={orgJsonLd()} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
