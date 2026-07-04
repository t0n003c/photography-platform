import type { CSSProperties } from "react";
import Link from "next/link";
import { Instagram, Mail } from "lucide-react";
import { Container } from "@/components/ui/container";
import { getMenu, type ResolvedMenuItem } from "@/src/db/queries/menus";
import { getSiteSettings } from "@/src/db/queries/settings";
import { getFooterConfig } from "@/src/db/queries/public";
import {
  isExternalFooterHref,
  normalizeFooterHref,
  type StickyFooterColumnConfig,
} from "@/src/lib/footer-config";
import { cn } from "@/src/lib/utils";
import { InertLabel } from "./inert-label";
import { FooterInstagram } from "./footer-instagram";

const linkCls =
  "text-sm text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]";

interface FooterRenderableLink {
  id: string;
  label: string;
  href: string;
  external: boolean;
  openInNewTab: boolean;
  noLink: boolean;
}

function FooterLink({
  item,
  className,
}: {
  item: FooterRenderableLink;
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

function Social({
  className,
  wrapperClassName,
}: {
  className?: string;
  wrapperClassName?: string;
} = {}) {
  const cls = cn(
    "text-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
    className,
  );
  return (
    <div className={cn("flex items-center gap-4", wrapperClassName)}>
      <a href="#" aria-label="Instagram" className={cls}>
        <Instagram className="h-5 w-5" aria-hidden="true" />
      </a>
      <a href="#" aria-label="Email" className={cls}>
        <Mail className="h-5 w-5" aria-hidden="true" />
      </a>
    </div>
  );
}

interface FooterColumn {
  id: string;
  label: string;
  links: FooterRenderableLink[];
}

function chunkFooterLinks(items: ResolvedMenuItem[], columns = 4) {
  const chunkSize = Math.max(1, Math.ceil(items.length / columns));
  return Array.from({ length: columns }, (_, index) =>
    items.slice(index * chunkSize, index * chunkSize + chunkSize),
  ).filter((column) => column.length > 0);
}

function resolveStickyFooterColumns(items: ResolvedMenuItem[]): FooterColumn[] {
  const nested = items
    .filter((item) => item.children.length > 0)
    .map((item) => ({ id: item.id, label: item.label, links: item.children }));
  if (nested.length > 0) {
    const standalone = items.filter((item) => item.children.length === 0);
    return standalone.length > 0
      ? [...nested, { id: "standalone-footer-links", label: "More", links: standalone }]
      : nested;
  }

  const labels = ["Product", "Solutions", "Resources", "Company"];
  return chunkFooterLinks(items.flatMap((item) => [item, ...item.children])).map(
    (links, index) => ({
      id: `fallback-${index}`,
      label: labels[index] ?? "More",
      links,
    }),
  );
}

function resolveCustomStickyFooterColumns(
  columns: StickyFooterColumnConfig[],
): FooterColumn[] {
  return columns.map((column) => ({
    id: column.id,
    label: column.label,
    links: column.links.map((link) => {
      const href = normalizeFooterHref(link.href);
      return {
        id: link.id,
        label: link.label,
        href,
        external: isExternalFooterHref(href),
        openInNewTab: link.openInNewTab,
        noLink: href === "#",
      };
    }),
  }));
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
  const stickyColumns =
    footer.stickyColumns.length > 0
      ? resolveCustomStickyFooterColumns(footer.stickyColumns)
      : resolveStickyFooterColumns(items);

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
    const stickyContentWeight =
      stickyColumns.length +
      stickyColumns.reduce((total, column) => total + column.links.length, 0) +
      (footer.text ? 2 : 0) +
      (footer.showSocial ? 1 : 0) +
      (footer.stickyLargeText ? 1 : 0);
    const stickyDensity =
      stickyContentWeight <= 10
        ? "compact"
        : stickyContentWeight <= 18
          ? "balanced"
          : "roomy";
    const revealHeights = {
      compact: {
        subtle: "clamp(22rem, 42svh, 30rem)",
        standard: "clamp(25rem, 50svh, 34rem)",
        dramatic: "clamp(30rem, 62svh, 42rem)",
      },
      balanced: {
        subtle: "clamp(26rem, 54svh, 36rem)",
        standard: "clamp(30rem, 64svh, 44rem)",
        dramatic: "clamp(36rem, 78svh, 54rem)",
      },
      roomy: {
        subtle: "clamp(30rem, 64svh, 42rem)",
        standard: "clamp(34rem, 82svh, 52rem)",
        dramatic: "clamp(40rem, 100svh, 64rem)",
      },
    } as const;
    const revealHeight = revealHeights[stickyDensity][footer.stickyRevealStrength];
    const stickyStyle = {
      "--sticky-footer-bg": footer.stickyBackgroundColor,
      "--sticky-footer-fg": footer.stickyTextColor,
      "--sticky-footer-accent": footer.stickyAccentColor,
      "--sticky-footer-reveal": revealHeight,
    } as CSSProperties;

    return (
      <footer
        className={cn(
          "sticky-site-footer",
          stickyDensity === "compact" && "sticky-site-footer--compact",
        )}
        style={stickyStyle}
      >
        <div className="sticky-site-footer__fixed">
          <Container className="sticky-site-footer__content">
            <div className="sticky-site-footer__main">
              <div className="sticky-site-footer__intro">
                <div className="sticky-site-footer__brand-row">
                  <span className="sticky-site-footer__brand-mark" aria-hidden="true">
                    <span />
                  </span>
                  {footer.stickyLargeText && (
                    <span className="sticky-site-footer__brand-name">
                      {settings.siteTitle}
                    </span>
                  )}
                </div>
                {footer.text && (
                  <p className="sticky-site-footer__tagline">
                    {footer.text}
                  </p>
                )}
                {footer.showSocial && (
                  <Social
                    className="sticky-site-footer__social-link"
                    wrapperClassName="sticky-site-footer__social"
                  />
                )}
              </div>

              <div className="sticky-site-footer__nav-grid">
                {stickyColumns.map((column) => (
                  <nav
                    key={column.id}
                    className="sticky-site-footer__column"
                    aria-label={column.label}
                  >
                    <p className="sticky-site-footer__column-title">
                      {column.label}
                    </p>
                    <div className="sticky-site-footer__links">
                      {column.links.map((item) => (
                        <FooterLink
                          key={item.id}
                          item={item}
                          className="sticky-site-footer__link"
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
              <p className="text-xs text-current/50">{settings.siteTitle}</p>
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
