import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { favorite, photo } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { ok } from "@/src/lib/http";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token/favorites — the photos this grant has favorited.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, { permission: "view" });
  if ("res" in resolved) return resolved.res;
  const { grant } = resolved.access;

  const rows = await db
    .select({ photo })
    .from(favorite)
    .innerJoin(photo, eq(favorite.photoId, photo.id))
    .where(and(eq(favorite.grantId, grant.id), isNull(photo.deletedAt)));

  const data = (await serializePhotos(rows.map((r) => r.photo))).map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      url: `${v.url}?t=${encodeURIComponent(token)}`,
    })),
  }));
  return ok({ data });
}
