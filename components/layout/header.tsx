import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav } from "@/components/layout/mobile-nav";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { CartNavBadge } from "@/components/store/cart-nav-badge";
import { getMenu } from "@/src/db/queries/menus";
import { getSiteSettings } from "@/src/db/queries/settings";

/**
 * Sticky site header with wordmark, primary nav, theme toggle, and a mobile
 * menu. Server component — the nav is data-driven (Admin → Menus); the
 * interactive bits are isolated client islands.
 */
export async function Header() {
  const [items, settings] = await Promise.all([
    getMenu("primary"),
    getSiteSettings(),
  ]);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="relative flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          {settings.siteTitle}
        </Link>

        <DesktopNav items={items} />

        <div className="flex items-center gap-2">
          <CartNavBadge />
          <ThemeToggle />
          <MobileNav items={items} />
        </div>
      </Container>
    </header>
  );
}
