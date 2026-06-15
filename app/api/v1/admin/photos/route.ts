import { and, desc, eq, ilike, isNull, lt, or } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { paginated } from "@/src/lib/http";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/photos — media-library cursor list (filters: processing, q).
export async function GET(req: Request) {
  const a = await requireRole("staff");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ c: string; id: string }>(
    url.searchParams.get("cursor"),
  );

  const PROCESSING = ["pending", "processing", "ready", "failed"] as const;
  const conds = [isNull(photo.deletedAt)];
  const processing = url.searchParams.get("processing");
  if (processing && (PROCESSING as readonly string[]).includes(processing)) {
    conds.push(
      eq(photo.processingStatus, processing as (typeof PROCESSING)[number]),
    );
  }
  const q = url.searchParams.get("q");
  if (q) conds.push(ilike(photo.filename, `%${q}%`));
  if (cur) {
    const cd = new Date(cur.c);
    conds.push(
      or(
        lt(photo.createdAt, cd),
        and(eq(photo.createdAt, cd), lt(photo.id, cur.id)),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(photo)
    .where(and(...conds))
    .orderBy(desc(photo.createdAt), desc(photo.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ c: last.createdAt.toISOString(), id: last.id })
      : null;

  const data = await serializePhotos(pageRows);
  return paginated(data, { nextCursor, hasMore, limit });
}
