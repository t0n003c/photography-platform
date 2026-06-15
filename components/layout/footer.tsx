import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";

const FOOTER_LINKS = [
  { href: "/", label: "Portfolio" },
  { href: "/categories", label: "Categories" },
  { href: "/locations", label: "Locations" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** Site footer. Server component. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold tracking-tight">Studio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            © {year} Studio. All rights reserved.
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-6 gap-y-2"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <a
            href="#"
            aria-label="Instagram"
            className="text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <Instagram className="h-5 w-5" aria-hidden="true" />
          </a>
          <a
            href="#"
            aria-label="Email"
            className="text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <Mail className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </Container>
    </footer>
  );
}
