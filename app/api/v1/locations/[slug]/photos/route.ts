import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { location, photoLocation, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { paginated, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Cursor-paginated photos for a published location.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const locRows = await db
    .select({ id: location.id })
    .from(location)
    .where(and(eq(location.slug, slug), eq(location.isPublished, true)))
    .limit(1);
  const loc = locRows[0];
  if (!loc) return notFound();

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ s: number; id: string }>(url.searchParams.get("cursor"));
  const rows = await db
    .select({ photo, s: photoLocation.sortOrder })
    .from(photoLocation)
    .innerJoin(photo, eq(photoLocation.photoId, photo.id))
    .where(
      and(
        eq(photoLocation.locationId, loc.id),
        eq(photo.processingStatus, "ready"),
        isNull(photo.deletedAt),
        cur
          ? or(
              gt(photoLocation.sortOrder, cur.s),
              and(eq(photoLocation.sortOrder, cur.s), gt(photo.id, cur.id)),
            )
          : undefined,
      ),
    )
    .orderBy(asc(photoLocation.sortOrder), asc(photo.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const data = await serializePhotos(pageRows.map((r) => r.photo));
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last ? encodeCursor({ s: last.s, id: last.photo.id }) : null;
  return paginated(data, { nextCursor, hasMore, limit });
}
