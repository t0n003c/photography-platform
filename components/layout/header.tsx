import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileNav, type NavLink } from "@/components/layout/mobile-nav";

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Portfolio" },
  { href: "/categories", label: "Categories" },
  { href: "/locations", label: "Locations" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/**
 * Sticky site header with wordmark, primary nav, theme toggle, and a mobile
 * menu. Server component (the interactive bits are isolated client islands).
 */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="relative flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          Studio
        </Link>

        <nav
          className="hidden items-center gap-8 md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileNav links={NAV_LINKS} />
        </div>
      </Container>
    </header>
  );
}
