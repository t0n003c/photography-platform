import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/src/lib/seo";
import {
  getPublishedCategories,
  getPublishedLocations,
  getPublicGalleries,
} from "@/src/db/queries/public";

const STATIC_ROUTES: {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/about", changeFrequency: "monthly", priority: 0.6 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6 },
  { path: "/categories", changeFrequency: "weekly", priority: 0.8 },
  { path: "/locations", changeFrequency: "weekly", priority: 0.8 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const [categories, locations, galleries] = await Promise.all([
      getPublishedCategories(),
      getPublishedLocations(),
      getPublicGalleries(),
    ]);

    const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
      url: absoluteUrl(`/categories/${c.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const locationEntries: MetadataRoute.Sitemap = locations.map((l) => ({
      url: absoluteUrl(`/locations/${l.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const galleryEntries: MetadataRoute.Sitemap = galleries.map((g) => ({
      url: absoluteUrl(`/galleries/${g.slug}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [
      ...staticEntries,
      ...categoryEntries,
      ...locationEntries,
      ...galleryEntries,
    ];
  } catch {
    // DB unavailable during build — fall back to static routes so `next build`
    // never fails.
    return staticEntries;
  }
}
