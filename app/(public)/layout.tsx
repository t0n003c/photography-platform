import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SmoothScroll } from "@/components/webgl/smooth-scroll";

// Chrome for all public pages (nested inside the root layout's ThemeProvider).
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SmoothScroll />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
