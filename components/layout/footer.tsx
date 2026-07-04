import type { CSSProperties } from "react";
import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { getMenu, type ResolvedMenuItem } from "@/src/db/queries/menus";
import { getSiteSettings } from "@/src/db/queries/settings";
import { getFooterConfig } from "@/src/db/queries/public";
import { cn } from "@/src/lib/utils";
import { InertLabel } from "./inert-label";
import { FooterInstagram } from "./footer-instagram";

const linkCls =
  "text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

function FooterLink({
  item,
  className,
}: {
  item: ResolvedMenuItem;
  className?: string;
}) {
  const cls = className ?? linkCls;
  if (item.noLink) {
    return <InertLabel label={item.label} className={cls} />;
  }
  if (item.external || item.openInNewTab) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer noopener" className={cls}>
        {item.label}
      </a>
    );
  }
  return (
    <Link href={item.href} className={cls}>
      {item.label}
    </Link>
  );
}

function Social({ className }: { className?: string } = {}) {
  const cls = cn(
    "text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
    className,
  );
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

function chunkFooterLinks(items: ResolvedMenuItem[], columns = 3) {
  const chunkSize = Math.max(1, Math.ceil(items.length / columns));
  return Array.from({ length: columns }, (_, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize),
  ).filter((column) => column.length > 0);
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
  const stickyColumns = chunkFooterLinks(flat);

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

  if (footer.layout === "sticky") {
    const revealHeight = {
      subtle: "clamp(28rem, 68svh, 42rem)",
      standard: "clamp(34rem, 82svh, 52rem)",
      dramatic: "clamp(40rem, 100svh, 64rem)",
    }[footer.stickyRevealStrength];
    const stickyStyle = {
      "--sticky-footer-bg": footer.stickyBackgroundColor,
      "--sticky-footer-fg": footer.stickyTextColor,
      "--sticky-footer-accent": footer.stickyAccentColor,
      "--sticky-footer-reveal": revealHeight,
    } as CSSProperties;

    return (
      <footer className="sticky-site-footer" style={stickyStyle}>
        <div className="sticky-site-footer__fixed">
          <Container className="sticky-site-footer__content">
            <div className="sticky-site-footer__main grid gap-10">
              <div className="sticky-site-footer__intro space-y-6">
                <div className="inline-flex items-center rounded-full border border-current/20 px-3 py-1 text-xs uppercase tracking-[0.28em] text-current/70">
                  {settings.siteTitle}
                </div>
                {footer.stickyLargeText && (
                  <p className="sticky-site-footer__brand">{settings.siteTitle}</p>
                )}
                {footer.text && (
                  <p className="sticky-site-footer__tagline max-w-2xl text-base leading-7 text-current/70 md:text-lg">
                    {footer.text}
                  </p>
                )}
              </div>

              <div className="sticky-site-footer__nav-grid grid gap-8 sm:grid-cols-3">
                {stickyColumns.map((column, columnIndex) => (
                  <nav
                    key={columnIndex}
                    className="space-y-3"
                    aria-label={columnIndex === 0 ? "Footer" : undefined}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/50">
                      {columnIndex === 0 ? "Navigate" : columnIndex === 1 ? "Explore" : "More"}
                    </p>
                    <div className="sticky-site-footer__links flex flex-col gap-2">
                      {column.map((item) => (
                        <FooterLink
                          key={item.id}
                          item={item}
                          className="text-sm text-current/70 transition-colors hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
                        />
                      ))}
                    </div>
                  </nav>
                ))}
              </div>
            </div>

            <div className="sticky-site-footer__bottom flex flex-col gap-5 border-t border-current/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="footer-copyright text-xs text-current/60">
                {copyright}
              </p>
              <div className="flex items-center gap-5">
                {footer.showSocial && (
                  <Social className="text-current/70 hover:text-current" />
                )}
                <a
                  href="#top"
                  className="inline-flex h-9 items-center rounded-full border border-current/20 px-4 text-xs font-medium uppercase tracking-[0.18em] text-current/80 transition hover:border-current/50 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
                >
                  Top
                </a>
              </div>
            </div>
          </Container>
        </div>
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
