import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { grantAuthorizesPhoto } from "@/src/db/queries/photos";
import { notFound } from "@/src/lib/http";
import { getStorage } from "@/src/storage";

export const dynamic = "force-dynamic";

// GET — stream a single ORIGINAL, full-quality file. Requires an active grant
// with download permission for a photo in the grant's gallery (SECURITY.md §7).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string; photoId: string }> },
) {
  const { token, photoId } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, {
    permission: "download",
  });
  if ("res" in resolved) return resolved.res;
  const { grant } = resolved.access;
  if (!(await grantAuthorizesPhoto(grant, photoId))) return notFound();

  const rows = await db.select().from(photo).where(eq(photo.id, photoId)).limit(1);
  const p = rows[0];
  if (!p || p.deletedAt) return notFound();

  const bytes = await getStorage().get(p.originalStorageKey);
  const filename = p.filename.replace(/["\\]/g, "_");
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": p.mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
