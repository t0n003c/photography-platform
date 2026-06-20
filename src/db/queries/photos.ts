import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  photo,
  photoVariant,
  gallery,
  galleryPhoto,
  collection,
  collectionPhoto,
  location,
  photoLocation,
} from "@/src/db/schema";
import type { Grant } from "@/src/auth/grant";

export type PhotoRow = typeof photo.$inferSelect;
export type VariantRow = typeof photoVariant.$inferSelect;

export interface PhotoVariantDTO {
  format: string;
  sizeBucket: string;
  width: number;
  height: number;
  url: string;
}

export interface PhotoDTO {
  id: string;
  altText: string | null;
  headline: string | null;
  subhead: string | null;
  caption: string | null;
  width: number;
  height: number;
  dominantColor: string | null;
  blurhash: string | null;
  lqip: string | null;
  capturedAt: string | null;
  variants: PhotoVariantDTO[];
}

// Variant URLs are app-served (StorageProvider-resolved) so MinIO need not be
// publicly exposed (API-DESIGN §7). Public variants are immutable/cacheable.
function variantUrl(variantId: string): string {
  return `/api/v1/media/v/${variantId}`;
}

export function serializePhoto(p: PhotoRow, variants: VariantRow[]): PhotoDTO {
  return {
    id: p.id,
    altText: p.altText,
    headline: p.headline,
    subhead: p.subhead,
    caption: p.caption,
    width: p.width,
    height: p.height,
    dominantColor: p.dominantColor,
    blurhash: p.blurhash,
    lqip: p.lqip,
    capturedAt: p.captureDate ? p.captureDate.toISOString() : null,
    variants: variants.map((v) => ({
      format: v.format,
      sizeBucket: v.sizeBucket,
      width: v.width,
      height: v.height,
      url: variantUrl(v.id),
    })),
  };
}

/** Load variants for many photos in one query, grouped by photo id. */
export async function loadVariants(
  photoIds: string[],
): Promise<Map<string, VariantRow[]>> {
  const map = new Map<string, VariantRow[]>();
  if (photoIds.length === 0) return map;
  const rows = await db
    .select()
    .from(photoVariant)
    .where(inArray(photoVariant.photoId, photoIds));
  for (const v of rows) {
    const list = map.get(v.photoId) ?? [];
    list.push(v);
    map.set(v.photoId, list);
  }
  return map;
}

export async function serializePhotos(rows: PhotoRow[]): Promise<PhotoDTO[]> {
  const variants = await loadVariants(rows.map((r) => r.id));
  return rows.map((r) => serializePhoto(r, variants.get(r.id) ?? []));
}

/** Is this photo reachable on the PUBLIC tier (published public surface)? */
export async function isPhotoPublic(photoId: string): Promise<boolean> {
  const inGallery = await db
    .select({ id: gallery.id })
    .from(galleryPhoto)
    .innerJoin(gallery, eq(galleryPhoto.galleryId, gallery.id))
    .where(
      and(
        eq(galleryPhoto.photoId, photoId),
        eq(gallery.visibility, "public"),
        eq(gallery.status, "published"),
        isNull(gallery.deletedAt),
      ),
    )
    .limit(1);
  if (inGallery.length) return true;

  const inCollection = await db
    .select({ id: collection.id })
    .from(collectionPhoto)
    .innerJoin(collection, eq(collectionPhoto.collectionId, collection.id))
    .where(
      and(
        eq(collectionPhoto.photoId, photoId),
        eq(collection.isPublished, true),
      ),
    )
    .limit(1);
  if (inCollection.length) return true;

  const inLocation = await db
    .select({ id: location.id })
    .from(photoLocation)
    .innerJoin(location, eq(photoLocation.locationId, location.id))
    .where(
      and(eq(photoLocation.photoId, photoId), eq(location.isPublished, true)),
    )
    .limit(1);
  return inLocation.length > 0;
}

/** Does an active grant authorize viewing this photo (it's in the grant's gallery)? */
export async function grantAuthorizesPhoto(
  grant: Grant,
  photoId: string,
): Promise<boolean> {
  if (!grant.canView) return false;
  const row = await db
    .select({ photoId: galleryPhoto.photoId })
    .from(galleryPhoto)
    .where(
      and(
        eq(galleryPhoto.galleryId, grant.galleryId),
        eq(galleryPhoto.photoId, photoId),
      ),
    )
    .limit(1);
  return row.length > 0;
}
