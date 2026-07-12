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

// Public email-preview image for an active client gallery share token. This
// intentionally does not require the password unlock cookie: it exposes only the
// first gallery image so client emails can render a useful preview card while
// the full gallery remains password-gated.
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, {
    permission: "view",
    requireUnlock: false,
  });
  if ("res" in resolved) return resolved.res;

  const photos = await db
    .select({ id: photo.id })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, resolved.access.gallery.id),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
      ),
    )
    .orderBy(asc(galleryPhoto.sortOrder), asc(photo.id))
    .limit(1);
  const firstPhoto = photos[0];
  if (!firstPhoto) return notFound();

  const variants = await db
    .select()
    .from(photoVariant)
    .where(eq(photoVariant.photoId, firstPhoto.id));
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
