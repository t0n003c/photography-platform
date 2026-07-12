import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { galleryPhoto, photo } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { paginated } from "@/src/lib/http";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token/photos — keyset-paginated photos for the grant's gallery.
// Variant URLs carry the share token so the media route can authorize them.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, { permission: "view" });
  if ("res" in resolved) return resolved.res;
  const { grant } = resolved.access;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ s: number; id: string }>(url.searchParams.get("cursor"));

  const rows = await db
    .select({ photo, s: galleryPhoto.sortOrder })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, grant.galleryId),
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

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const data = (await serializePhotos(pageRows.map((r) => r.photo))).map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      url: `${v.url}?t=${encodeURIComponent(token)}`,
    })),
  }));
  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last ? encodeCursor({ s: last.s, id: last.photo.id }) : null;
  return paginated(data, { nextCursor, hasMore, limit });
}
