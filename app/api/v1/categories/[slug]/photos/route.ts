import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { collection, collectionPhoto, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { paginated, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Cursor-paginated photos for a published category.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const colRows = await db
    .select({ id: collection.id })
    .from(collection)
    .where(and(eq(collection.slug, slug), eq(collection.isPublished, true)))
    .limit(1);
  const col = colRows[0];
  if (!col) return notFound();

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ s: number; id: string }>(url.searchParams.get("cursor"));
  const rows = await db
    .select({ photo, s: collectionPhoto.sortOrder })
    .from(collectionPhoto)
    .innerJoin(photo, eq(collectionPhoto.photoId, photo.id))
    .where(
      and(
        eq(collectionPhoto.collectionId, col.id),
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

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const data = await serializePhotos(pageRows.map((r) => r.photo));
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? encodeCursor({ s: last.s, id: last.photo.id }) : null;
  return paginated(data, { nextCursor, hasMore, limit });
}
