import type { Metadata } from "next";
import { getEnv } from "@/src/lib/env";

export const SITE = {
  name: "Photography Platform",
  description:
    "A self-hosted photography studio — fine-art portfolios, private client galleries, and museum-quality prints. Crafted imagery across portrait, landscape, and editorial work.",
} as const;

/** Join APP_BASE_URL + path into an absolute URL. */
export function absoluteUrl(path: string): string {
  const base = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  if (!path) return base;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export interface BuildMetadataOptions {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
}

/** Build a Next.js Metadata object with canonical, Open Graph and Twitter tags. */
export function buildMetadata(opts: BuildMetadataOptions = {}): Metadata {
  const {
    title,
    description = SITE.description,
    path = "/",
    image,
    type = "website",
  } = opts;

  const url = absoluteUrl(path);
  const images = image
    ? [{ url: absoluteUrl(image) }]
    : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: title ?? SITE.name,
      description,
      url,
      siteName: SITE.name,
      images,
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: title ?? SITE.name,
      description,
      images: images?.map((i) => i.url),
    },
  };
}

// ── JSON-LD builders ─────────────────────────────────────────────────────────

/** Organization / LocalBusiness style structured data for the studio. */
export function orgJsonLd(override?: {
  name?: string;
  description?: string;
  logo?: string;
}) {
  const url = absoluteUrl("/");
  const logo = absoluteUrl(override?.logo ?? "/icon.svg");
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
    name: override?.name ?? SITE.name,
    description: override?.description ?? SITE.description,
    url,
    logo,
    image: logo,
  };
}

/** BreadcrumbList structured data. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** ImageGallery structured data. */
export function imageGalleryJsonLd(opts: {
  name: string;
  path: string;
  images: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: opts.name,
    url: absoluteUrl(opts.path),
    image: opts.images.map((img) =>
      img.startsWith("http") ? img : absoluteUrl(img),
    ),
  };
}
