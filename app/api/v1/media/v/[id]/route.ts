import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo, photoVariant } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import { isPhotoPublic, grantAuthorizesPhoto } from "@/src/db/queries/photos";
import { resolveGrant } from "@/src/auth/grant";
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
    const token = new URL(req.url).searchParams.get("t") ?? "";
    const grant = token ? await resolveGrant(token) : null;
    const authorized = grant ? await grantAuthorizesPhoto(grant, p.id) : false;
    if (!authorized) return notFound(); // do not reveal private existence
    cacheControl = "private, no-store";
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
