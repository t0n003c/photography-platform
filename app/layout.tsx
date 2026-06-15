import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
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
