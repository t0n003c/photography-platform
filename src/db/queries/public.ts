import { and, asc, desc, eq, gt, isNull, or } from "drizzle-orm";
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
  coverPhotoId: string | null;
}
export interface GallerySummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverPhotoId: string | null;
}
export interface PhotoPage {
  photos: PhotoDTO[];
  nextCursor: string | null;
}

interface MembershipCursor {
  s: number;
  id: string;
}

const PAGE = 48;

// ── Categories ───────────────────────────────────────────────────────────────
export async function getPublishedCategories(): Promise<CategorySummary[]> {
  return db
    .select({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      description: collection.description,
      coverPhotoId: collection.coverPhotoId,
    })
    .from(collection)
    .where(eq(collection.isPublished, true))
    .orderBy(asc(collection.sortOrder), asc(collection.name));
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
  return db
    .select({
      id: location.id,
      slug: location.slug,
      name: location.name,
      region: location.region,
      coverPhotoId: location.coverPhotoId,
    })
    .from(location)
    .where(eq(location.isPublished, true))
    .orderBy(asc(location.sortOrder), asc(location.name));
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
      coverPhotoId: location.coverPhotoId,
    })
    .from(location)
    .where(and(eq(location.slug, slug), eq(location.isPublished, true)))
    .limit(1);
  return rows[0] ?? null;
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

// ── Public galleries ─────────────────────────────────────────────────────────
export async function getPublicGalleries(): Promise<GallerySummary[]> {
  return db
    .select({
      id: gallery.id,
      slug: gallery.slug,
      title: gallery.title,
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
  }
  const rows = await db
    .select()
    .from(pageConfig)
    .where(and(eq(pageConfig.scope, scope), eq(pageConfig.isDefault, true)))
    .limit(1);
  return rows[0] ?? null;
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
