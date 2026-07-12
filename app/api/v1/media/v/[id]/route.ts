import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo, photoVariant } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import { isPhotoPublic, grantAuthorizesPhoto } from "@/src/db/queries/photos";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { getSession } from "@/src/auth/session";
import { notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Serves a re-encoded variant's bytes via the StorageProvider. Public photos are
// far-future cacheable; private (client-gallery) photos require an active grant
// token (?t=) and are never cached at shared layers (SECURITY.md §7, CACHING §).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const vrows = await db
    .select()
    .from(photoVariant)
    .where(eq(photoVariant.id, id))
    .limit(1);
  const variant = vrows[0];
  if (!variant) return notFound();

  const prows = await db
    .select()
    .from(photo)
    .where(eq(photo.id, variant.photoId))
    .limit(1);
  const p = prows[0];
  if (!p || p.deletedAt) return notFound();

  let cacheControl = "public, max-age=31536000, immutable";
  if (!(await isPhotoPublic(p.id))) {
    // Authenticated admin-panel users (Library, page builder, editors) may view
    // any photo's bytes — including freshly uploaded ones not yet in a published
    // gallery. Without this, every Library thumbnail 404s and only the LQIP shows.
    const session = await getSession();
    if (session) {
      cacheControl = "private, no-store";
    } else {
      // Otherwise require a client-gallery grant token (?t=).
      const token = new URL(req.url).searchParams.get("t") ?? "";
      if (!token) return notFound();
      const resolved = await requireClientGalleryAccess(token, {
        permission: "view",
      });
      if ("res" in resolved) return resolved.res;
      const authorized = await grantAuthorizesPhoto(resolved.access.grant, p.id);
      if (!authorized) return notFound(); // do not reveal private existence
      cacheControl = "private, no-store";
    }
  }

  const bytes = await getStorage().get(variant.storageKey);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": `image/${variant.format}`,
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
