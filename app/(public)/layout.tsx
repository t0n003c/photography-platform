import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TrafficSourceBeacon } from "@/components/analytics/traffic-source-beacon";
import { SmoothScroll } from "@/components/webgl/smooth-scroll";

// Chrome for all public pages (nested inside the root layout's ThemeProvider).
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SmoothScroll />
      <TrafficSourceBeacon />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
