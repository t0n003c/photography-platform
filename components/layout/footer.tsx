import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { getMenu, type ResolvedMenuItem } from "@/src/db/queries/menus";
import { getSiteSettings } from "@/src/db/queries/settings";
import { getFooterConfig } from "@/src/db/queries/public";
import { InertLabel } from "./inert-label";
import { FooterInstagram } from "./footer-instagram";

const linkCls =
  "text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function FooterLink({ item }: { item: ResolvedMenuItem }) {
  if (item.noLink) {
    return <InertLabel label={item.label} className={linkCls} />;
  }
  if (item.external || item.openInNewTab) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer noopener" className={linkCls}>
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

function Social() {
  const cls =
    "text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";
  return (
    <div className="flex items-center gap-4">
      <a href="#" aria-label="Instagram" className={cls}>
        <Instagram className="h-5 w-5" aria-hidden="true" />
      </a>
      <a href="#" aria-label="Email" className={cls}>
        <Mail className="h-5 w-5" aria-hidden="true" />
      </a>
    </div>
  );
}

/**
 * Site footer. Server component. Footer menu links come from Admin → Menus
 * (active footer preset); the overall composition (menu / logo+text /
 * instagram / text) comes from Admin → Design → Footer.
 */
export async function Footer() {
  const year = new Date().getFullYear();
  const [items, settings, footer] = await Promise.all([
    getMenu("footer"),
    getSiteSettings(),
    getFooterConfig(),
  ]);
  const flat = items.flatMap((i) => [i, ...i.children]);
  const copyright = `© ${year} ${settings.siteTitle}. All rights reserved.`;

  // The "menu" layout keeps the original three-column composition (and carries
  // its own copyright); the others render a centered body + a shared bottom row.
  if (footer.layout === "menu") {
    return (
      <footer className="mt-16 border-t">
        <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold tracking-tight">{settings.siteTitle}</p>
            <p className="footer-copyright mt-1 text-sm text-muted-foreground">
              {copyright}
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            {flat.map((item) => (
              <FooterLink key={item.id} item={item} />
            ))}
          </nav>
          {footer.showSocial && <Social />}
        </Container>
      </footer>
    );
  }

  let body: React.ReactNode = null;
  if (footer.layout === "logo-text") {
    body = (
      <div className="flex flex-col items-center gap-4 text-center">
        {settings.logoStorageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/v1/media/site-logo" alt={settings.siteTitle} className="h-10 w-auto" />
        ) : (
          <p className="text-lg font-semibold tracking-tight">{settings.siteTitle}</p>
        )}
        {footer.text && (
          <p className="max-w-xl text-sm text-muted-foreground">{footer.text}</p>
        )}
      </div>
    );
  } else if (footer.layout === "instagram") {
    body = <FooterInstagram limit={footer.instagramLimit} />;
  } else {
    // "text"
    body = footer.text ? (
      <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
        {footer.text}
      </p>
    ) : null;
  }

  return (
    <footer className="mt-16 border-t">
      <Container className="space-y-6 py-12">
        {body}
        <div className="flex flex-col items-center gap-3">
          {footer.showSocial && <Social />}
          <p className="footer-copyright text-xs text-muted-foreground">
            {copyright}
          </p>
        </div>
      </Container>
    </footer>
  );
}
