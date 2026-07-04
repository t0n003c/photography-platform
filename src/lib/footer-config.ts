export type FooterLayout = "menu" | "logo-text" | "instagram" | "text" | "sticky";
export type FooterRevealStrength = "subtle" | "standard" | "dramatic";

export interface StickyFooterLinkConfig {
  id: string;
  label: string;
  href: string;
  openInNewTab: boolean;
}

export interface StickyFooterColumnConfig {
  id: string;
  label: string;
  links: StickyFooterLinkConfig[];
}

export interface FooterConfig {
  layout: FooterLayout;
  text: string;
  instagramLimit: number;
  showSocial: boolean;
  stickyBackgroundColor: string;
  stickyTextColor: string;
  stickyAccentColor: string;
  stickyLargeText: boolean;
  stickyRevealStrength: FooterRevealStrength;
  stickyColumns: StickyFooterColumnConfig[];
}

export const DEFAULT_FOOTER_CONFIG: FooterConfig = {
  layout: "menu",
  text: "",
  instagramLimit: 6,
  showSocial: true,
  stickyBackgroundColor: "#08090d",
  stickyTextColor: "#f8fafc",
  stickyAccentColor: "#8b5cf6",
  stickyLargeText: true,
  stickyRevealStrength: "standard",
  stickyColumns: [],
};

export const STICKY_FOOTER_STARTER_COLUMNS: StickyFooterColumnConfig[] = [
  {
    id: "starter-product",
    label: "Product",
    links: [
      { id: "starter-product-portfolio", label: "Portfolio", href: "/", openInNewTab: false },
      { id: "starter-product-galleries", label: "Galleries", href: "/galleries", openInNewTab: false },
      { id: "starter-product-contact", label: "Contact", href: "/contact", openInNewTab: false },
    ],
  },
  {
    id: "starter-solutions",
    label: "Solutions",
    links: [
      { id: "starter-solutions-categories", label: "Categories", href: "/categories", openInNewTab: false },
      { id: "starter-solutions-locations", label: "Locations", href: "/locations", openInNewTab: false },
      { id: "starter-solutions-about", label: "About", href: "/about", openInNewTab: false },
    ],
  },
  {
    id: "starter-resources",
    label: "Resources",
    links: [
      { id: "starter-resources-journal", label: "Journal", href: "/about", openInNewTab: false },
      { id: "starter-resources-pricing", label: "Pricing", href: "/contact", openInNewTab: false },
      { id: "starter-resources-help", label: "Help", href: "/contact", openInNewTab: false },
    ],
  },
  {
    id: "starter-company",
    label: "Company",
    links: [
      { id: "starter-company-about", label: "About", href: "/about", openInNewTab: false },
      { id: "starter-company-contact", label: "Contact", href: "/contact", openInNewTab: false },
      { id: "starter-company-instagram", label: "Instagram", href: "https://instagram.com", openInNewTab: true },
    ],
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function cleanId(value: unknown, fallback: string): string {
  const id = asString(value).trim();
  return id || fallback;
}

export function normalizeFooterHref(value: unknown): string {
  const raw = asString(value).trim();
  if (!raw) return "#";
  if (
    raw.startsWith("/") ||
    raw.startsWith("#") ||
    /^https?:\/\//i.test(raw) ||
    /^mailto:/i.test(raw) ||
    /^tel:/i.test(raw)
  ) {
    return raw;
  }
  return `/${raw.replace(/^\/+/, "")}`;
}

export function isExternalFooterHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href);
}

export function normalizeStickyFooterColumns(value: unknown): StickyFooterColumnConfig[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((columnValue, columnIndex) => {
      const column = asRecord(columnValue);
      const linksValue = Array.isArray(column.links) ? column.links : [];
      const links = linksValue
        .map((linkValue, linkIndex) => {
          const link = asRecord(linkValue);
          const label = asString(link.label).trim();
          const href = normalizeFooterHref(link.href);
          if (!label) return null;
          return {
            id: cleanId(link.id, `footer-link-${columnIndex}-${linkIndex}`),
            label,
            href,
            openInNewTab: Boolean(link.openInNewTab),
          };
        })
        .filter((link): link is StickyFooterLinkConfig => Boolean(link));

      const label = asString(column.label).trim();
      if (!label && links.length === 0) return null;
      return {
        id: cleanId(column.id, `footer-column-${columnIndex}`),
        label: label || `Column ${columnIndex + 1}`,
        links,
      };
    })
    .filter((column): column is StickyFooterColumnConfig => Boolean(column));
}

export function normalizeFooterConfig(value: unknown): FooterConfig {
  const raw = asRecord(value);
  const layout = asString(raw.layout);
  const reveal = asString(raw.stickyRevealStrength);

  return {
    layout: ["menu", "logo-text", "instagram", "text", "sticky"].includes(layout)
      ? (layout as FooterLayout)
      : DEFAULT_FOOTER_CONFIG.layout,
    text: asString(raw.text, DEFAULT_FOOTER_CONFIG.text),
    instagramLimit:
      typeof raw.instagramLimit === "number"
        ? raw.instagramLimit
        : DEFAULT_FOOTER_CONFIG.instagramLimit,
    showSocial:
      typeof raw.showSocial === "boolean"
        ? raw.showSocial
        : DEFAULT_FOOTER_CONFIG.showSocial,
    stickyBackgroundColor: asString(
      raw.stickyBackgroundColor,
      DEFAULT_FOOTER_CONFIG.stickyBackgroundColor,
    ),
    stickyTextColor: asString(raw.stickyTextColor, DEFAULT_FOOTER_CONFIG.stickyTextColor),
    stickyAccentColor: asString(
      raw.stickyAccentColor,
      DEFAULT_FOOTER_CONFIG.stickyAccentColor,
    ),
    stickyLargeText:
      typeof raw.stickyLargeText === "boolean"
        ? raw.stickyLargeText
        : DEFAULT_FOOTER_CONFIG.stickyLargeText,
    stickyRevealStrength: ["subtle", "standard", "dramatic"].includes(reveal)
      ? (reveal as FooterRevealStrength)
      : DEFAULT_FOOTER_CONFIG.stickyRevealStrength,
    stickyColumns: normalizeStickyFooterColumns(raw.stickyColumns),
  };
}
