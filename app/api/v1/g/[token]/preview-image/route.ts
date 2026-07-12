import { asc, and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { galleryPhoto, photo, photoVariant } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { getStorage } from "@/src/storage";
import { notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  avif: "image/avif",
  webp: "image/webp",
  jpeg: "image/jpeg",
};

function choosePreviewVariant(variants: (typeof photoVariant.$inferSelect)[]) {
  return (
    variants.find((v) => v.format === "jpeg" && v.sizeBucket === "large") ??
    variants.find((v) => v.format === "jpeg" && v.sizeBucket === "medium") ??
    variants.find((v) => v.sizeBucket === "large") ??
    variants.find((v) => v.sizeBucket === "medium") ??
    variants[0] ??
    null
  );
}

async function loadOrderedPhotoIds(galleryId: string, limit: number) {
  return db
    .select({ id: photo.id })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, galleryId),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
      ),
    )
    .orderBy(asc(galleryPhoto.sortOrder), asc(photo.id))
    .limit(limit);
}

async function loadCoverPhotoId(galleryId: string, coverPhotoId: string | null) {
  if (!coverPhotoId) return null;
  const rows = await db
    .select({ id: photo.id })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, galleryId),
        eq(galleryPhoto.photoId, coverPhotoId),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

function parseSlot(value: string | null) {
  if (!value || value === "cover") return "cover";
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) && index >= 0 && index <= 4 ? index : null;
}

// Public email-preview image for an active client gallery share token. This
// intentionally does not require the password unlock cookie: it exposes only the
// cover image or up to the first five gallery images so client emails can render
// a useful preview card while the full gallery remains password-gated.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, {
    permission: "view",
    requireUnlock: false,
  });
  if ("res" in resolved) return resolved.res;

  const slot = parseSlot(new URL(req.url).searchParams.get("slot"));
  if (slot === null) return notFound();

  const galleryId = resolved.access.gallery.id;
  let photoId: string | null = null;
  if (slot === "cover") {
    photoId = await loadCoverPhotoId(galleryId, resolved.access.gallery.coverPhotoId);
    if (!photoId) {
      photoId = (await loadOrderedPhotoIds(galleryId, 1))[0]?.id ?? null;
    }
  } else {
    photoId = (await loadOrderedPhotoIds(galleryId, slot + 1))[slot]?.id ?? null;
  }
  if (!photoId) return notFound();

  const variants = await db
    .select()
    .from(photoVariant)
    .where(eq(photoVariant.photoId, photoId));
  const variant = choosePreviewVariant(variants);
  if (!variant) return notFound();

  const bytes = await getStorage().get(variant.storageKey);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": MIME[variant.format] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
