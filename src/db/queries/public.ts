import { and, asc, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  collection,
  collectionPhoto,
  gallery,
  galleryPhoto,
  location,
  photo,
  photoLocation,
  pageConfig,
} from "@/src/db/schema";
import { serializePhotos, type PhotoDTO } from "@/src/db/queries/photos";
import { encodeCursor, decodeCursor } from "@/src/lib/cursor";
import { cached, CACHE_KEYS } from "@/src/lib/cache";
import {
  normalizeLoginDesign,
  type LoginDesignConfig,
} from "@/src/lib/login-design";
import {
  normalizeFooterConfig,
  type FooterConfig,
} from "@/src/lib/footer-config";

// Read layer for the public site (RSC). Server Components call these directly
// (no HTTP hop); the matching Route Handlers exist for the PWA/client fetches.

export interface CategorySummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  coverPhotoId: string | null;
}
export interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  region: string | null;
  lat: number | null;
  lng: number | null;
  coverPhotoId: string | null;
}
export interface LocationMapItem extends LocationSummary {
  photoCount: number;
  cover: PhotoDTO | null;
}
export interface GallerySummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverPhotoId: string | null;
}
export interface PhotoPage {
  photos: PhotoDTO[];
  nextCursor: string | null;
}
export type PhotoFilterMode = "category" | "location";
export interface PhotoFilterMembership {
  photoId: string;
  key: string;
  label: string;
}

interface MembershipCursor {
  s: number;
  id: string;
}

const PAGE = 48;

// ── Categories ───────────────────────────────────────────────────────────────
export async function getPublishedCategories(): Promise<CategorySummary[]> {
  return cached(CACHE_KEYS.categories, 300, () =>
    db
      .select({
        id: collection.id,
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
        coverPhotoId: collection.coverPhotoId,
      })
      .from(collection)
      .where(eq(collection.isPublished, true))
      .orderBy(asc(collection.sortOrder), asc(collection.name)),
  );
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategorySummary | null> {
  const rows = await db
    .select({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      description: collection.description,
      coverPhotoId: collection.coverPhotoId,
    })
    .from(collection)
    .where(and(eq(collection.slug, slug), eq(collection.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCategoryPhotos(
  collectionId: string,
  cursor?: string | null,
  limit = PAGE,
): Promise<PhotoPage> {
  const cur = decodeCursor<MembershipCursor>(cursor ?? null);
  const rows = await db
    .select({ photo, s: collectionPhoto.sortOrder })
    .from(collectionPhoto)
    .innerJoin(photo, eq(collectionPhoto.photoId, photo.id))
    .where(
      and(
        eq(collectionPhoto.collectionId, collectionId),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
        cur
          ? or(
              gt(collectionPhoto.sortOrder, cur.s),
              and(eq(collectionPhoto.sortOrder, cur.s), gt(photo.id, cur.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(collectionPhoto.sortOrder), asc(photo.id))
    .limit(limit + 1);
  return pageFromRows(rows, limit);
}

// ── Locations ────────────────────────────────────────────────────────────────
export async function getPublishedLocations(): Promise<LocationSummary[]> {
  return cached(CACHE_KEYS.locations, 300, () =>
    db
      .select({
        id: location.id,
        slug: location.slug,
        name: location.name,
        region: location.region,
        lat: location.lat,
        lng: location.lng,
        coverPhotoId: location.coverPhotoId,
      })
      .from(location)
      .where(eq(location.isPublished, true))
      .orderBy(asc(location.sortOrder), asc(location.name)),
  );
}

export async function getLocationBySlug(
  slug: string,
): Promise<LocationSummary | null> {
  const rows = await db
    .select({
      id: location.id,
      slug: location.slug,
      name: location.name,
      region: location.region,
      lat: location.lat,
      lng: location.lng,
      coverPhotoId: location.coverPhotoId,
    })
    .from(location)
    .where(and(eq(location.slug, slug), eq(location.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublishedLocationMapItems(
  locationIds: string[] = [],
): Promise<LocationMapItem[]> {
  const selectedIds = [...new Set(locationIds.filter(Boolean))];
  const rows = await db
    .select({
      id: location.id,
      slug: location.slug,
      name: location.name,
      region: location.region,
      lat: location.lat,
      lng: location.lng,
      coverPhotoId: location.coverPhotoId,
      sortOrder: location.sortOrder,
    })
    .from(location)
    .where(
      and(
        eq(location.isPublished, true),
        selectedIds.length ? inArray(location.id, selectedIds) : undefined,
      ),
    )
    .orderBy(asc(location.sortOrder), asc(location.name));

  const order = new Map(selectedIds.map((id, index) => [id, index]));
  const ordered = selectedIds.length
    ? [...rows].sort(
        (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999),
      )
    : rows;

  if (ordered.length === 0) return [];
  const ids = ordered.map((item) => item.id);
  const counts = await db
    .select({ id: photoLocation.locationId, n: photo.id })
    .from(photoLocation)
    .innerJoin(photo, eq(photoLocation.photoId, photo.id))
    .where(
      and(
        inArray(photoLocation.locationId, ids),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
      ),
    );
  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(row.id, (countMap.get(row.id) ?? 0) + 1);
  }

  const items = await Promise.all(
    ordered.map(async (item) => {
      const { photos } = await getLocationPhotos(item.id, null, 1);
      return {
        ...item,
        photoCount: countMap.get(item.id) ?? 0,
        cover: photos[0] ?? null,
      };
    }),
  );

  return items;
}

export async function getLocationPhotos(
  locationId: string,
  cursor?: string | null,
  limit = PAGE,
): Promise<PhotoPage> {
  const cur = decodeCursor<MembershipCursor>(cursor ?? null);
  const rows = await db
    .select({ photo, s: photoLocation.sortOrder })
    .from(photoLocation)
    .innerJoin(photo, eq(photoLocation.photoId, photo.id))
    .where(
      and(
        eq(photoLocation.locationId, locationId),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
        cur
          ? or(
              gt(photoLocation.sortOrder, cur.s),
              and(eq(photoLocation.sortOrder, cur.s), gt(photo.id, cur.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(photoLocation.sortOrder), asc(photo.id))
    .limit(limit + 1);
  return pageFromRows(rows, limit);
}

// Filter labels for page-builder gallery blocks. The page block already chooses
// the photo set; this only derives tabs from published category/location links.
export async function getPhotoFilterMemberships(
  photoIds: string[],
  mode: PhotoFilterMode,
): Promise<PhotoFilterMembership[]> {
  if (photoIds.length === 0) return [];
  const ids = [...new Set(photoIds)];

  if (mode === "category") {
    return db
      .select({
        photoId: collectionPhoto.photoId,
        key: collection.id,
        label: collection.name,
      })
      .from(collectionPhoto)
      .innerJoin(collection, eq(collectionPhoto.collectionId, collection.id))
      .where(
        and(
          inArray(collectionPhoto.photoId, ids),
          eq(collection.isPublished, true),
        ),
      )
      .orderBy(asc(collection.sortOrder), asc(collection.name));
  }

  return db
    .select({
      photoId: photoLocation.photoId,
      key: location.id,
      label: location.name,
    })
    .from(photoLocation)
    .innerJoin(location, eq(photoLocation.locationId, location.id))
    .where(
      and(
        inArray(photoLocation.photoId, ids),
        eq(location.isPublished, true),
      ),
    )
    .orderBy(asc(location.sortOrder), asc(location.name));
}

// ── Public galleries ─────────────────────────────────────────────────────────
export async function getPublicGalleries(): Promise<GallerySummary[]> {
  return db
    .select({
      id: gallery.id,
      slug: gallery.slug,
      title: gallery.title,
      subtitle: gallery.subtitle,
      description: gallery.description,
      coverPhotoId: gallery.coverPhotoId,
    })
    .from(gallery)
    .where(
      and(
        eq(gallery.visibility, "public"),
        eq(gallery.status, "published"),
        isNull(gallery.deletedAt),
      ),
    )
    .orderBy(desc(gallery.publishedAt));
}

export async function getPublicGalleryBySlug(slug: string) {
  const rows = await db
    .select()
    .from(gallery)
    .where(
      and(
        eq(gallery.slug, slug),
        eq(gallery.visibility, "public"),
        eq(gallery.status, "published"),
        isNull(gallery.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getGalleryPhotos(
  galleryId: string,
  cursor?: string | null,
  limit = PAGE,
): Promise<PhotoPage> {
  const cur = decodeCursor<MembershipCursor>(cursor ?? null);
  const rows = await db
    .select({ photo, s: galleryPhoto.sortOrder })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, galleryId),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
        cur
          ? or(
              gt(galleryPhoto.sortOrder, cur.s),
              and(eq(galleryPhoto.sortOrder, cur.s), gt(photo.id, cur.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(galleryPhoto.sortOrder), asc(photo.id))
    .limit(limit + 1);
  return pageFromRows(rows, limit);
}

// ── Home: latest ready public photos as "featured" ──────────────────────────
export async function getFeaturedPhotos(limit = 12): Promise<PhotoDTO[]> {
  // Recent ready photos that appear in any published category; dedup in JS
  // (a photo may belong to several categories).
  const rows = await db
    .select({ photo })
    .from(collectionPhoto)
    .innerJoin(photo, eq(collectionPhoto.photoId, photo.id))
    .innerJoin(collection, eq(collectionPhoto.collectionId, collection.id))
    .where(
      and(
        eq(collection.isPublished, true),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
      ),
    )
    .orderBy(desc(photo.createdAt))
    .limit(limit * 3);
  const seen = new Set<string>();
  const unique: (typeof photo.$inferSelect)[] = [];
  for (const r of rows) {
    if (seen.has(r.photo.id)) continue;
    seen.add(r.photo.id);
    unique.push(r.photo);
    if (unique.length >= limit) break;
  }
  return serializePhotos(unique);
}

// ── Page config resolution ───────────────────────────────────────────────────
export async function resolvePageConfig(
  scope: "home" | "gallery" | "category" | "location" | "about" | "global",
  explicitId?: string | null,
) {
  if (explicitId) {
    const rows = await db
      .select()
      .from(pageConfig)
      .where(eq(pageConfig.id, explicitId))
      .limit(1);
    if (rows[0]) return rows[0];
    // Fall through to the default lookup, but skip the cache when an explicit
    // id was requested.
    return loadDefaultPageConfig(scope);
  }
  return cached(CACHE_KEYS.pageConfig(scope), 300, () =>
    loadDefaultPageConfig(scope),
  );
}

async function loadDefaultPageConfig(
  scope: "home" | "gallery" | "category" | "location" | "about" | "global",
) {
  const rows = await db
    .select()
    .from(pageConfig)
    .where(and(eq(pageConfig.scope, scope), eq(pageConfig.isDefault, true)))
    .limit(1);
  return rows[0] ?? null;
}

// ── Footer composition ───────────────────────────────────────────────────────
export type { FooterConfig, FooterLayout } from "@/src/lib/footer-config";

// Footer composition lives in the global page_config's `config.footer` jsonb,
// edited under Design → Footer. Cached via resolvePageConfig (5m) and
// invalidated when that config is saved.
export async function getFooterConfig(): Promise<FooterConfig> {
  const cfg = await resolvePageConfig("global");
  const f = (cfg?.config as { footer?: unknown } | null)?.footer;
  return normalizeFooterConfig(f);
}

// ── Login screen composition ─────────────────────────────────────────────────
// Visual-only settings for /login. Auth behavior stays in the login component
// and Better Auth; this config controls the card skin/copy only.
export async function getLoginConfig(): Promise<LoginDesignConfig> {
  const cfg = await resolvePageConfig("global");
  const login = (cfg?.config as { login?: unknown } | null)?.login;
  return normalizeLoginDesign(login);
}

// ── shared ───────────────────────────────────────────────────────────────────
async function pageFromRows(
  rows: { photo: typeof photo.$inferSelect; s: number }[],
  limit: number,
): Promise<PhotoPage> {
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const photos = await serializePhotos(pageRows.map((r) => r.photo));
  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ s: last.s, id: last.photo.id }) : null;
  return { photos, nextCursor };
}
