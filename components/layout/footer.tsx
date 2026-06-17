import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { getMenu, type ResolvedMenuItem } from "@/src/db/queries/menus";
import { getSiteSettings } from "@/src/db/queries/settings";

const linkCls =
  "text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function FooterLink({ item }: { item: ResolvedMenuItem }) {
  if (item.external || item.openInNewTab) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        className={linkCls}
      >
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={linkCls}>
      {item.label}
    </Link>
  );
}

/** Site footer. Server component — links from Admin → Menus (footer). */
export async function Footer() {
  const year = new Date().getFullYear();
  const [items, settings] = await Promise.all([
    getMenu("footer"),
    getSiteSettings(),
  ]);
  // Footers are flat: surface top-level items and any children as siblings.
  const flat = items.flatMap((i) => [i, ...i.children]);

  return (
    <footer className="mt-16 border-t">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold tracking-tight">
            {settings.siteTitle}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            © {year} {settings.siteTitle}. All rights reserved.
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-6 gap-y-2"
          aria-label="Footer"
        >
          {flat.map((item) => (
            <FooterLink key={item.id} item={item} />
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
