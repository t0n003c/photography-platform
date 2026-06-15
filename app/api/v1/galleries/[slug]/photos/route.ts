import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { gallery, galleryPhoto, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { paginated, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Cursor-paginated photos for a published, public gallery.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const gRows = await db
    .select({ id: gallery.id })
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
  const g = gRows[0];
  if (!g) return notFound();

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ s: number; id: string }>(url.searchParams.get("cursor"));
  const rows = await db
    .select({ photo, s: galleryPhoto.sortOrder })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(
      and(
        eq(galleryPhoto.galleryId, g.id),
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
  const data = await serializePhotos(pageRows.map((r) => r.photo));
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? encodeCursor({ s: last.s, id: last.photo.id }) : null;
  return paginated(data, { nextCursor, hasMore, limit });
}
