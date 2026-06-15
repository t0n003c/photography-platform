import { and, desc, eq, lt, or } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { paginated } from "@/src/lib/http";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { db } from "@/src/db/client";
import { contactSubmission } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/contact — cursor list (filters: status, verdict).
export async function GET(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ c: string; id: string }>(
    url.searchParams.get("cursor"),
  );

  const STATUS = ["new", "read", "replied", "archived", "spam"] as const;
  const VERDICT = ["ham", "spam", "unknown"] as const;
  const conds = [];
  const status = url.searchParams.get("status");
  if (status && (STATUS as readonly string[]).includes(status)) {
    conds.push(
      eq(contactSubmission.status, status as (typeof STATUS)[number]),
    );
  }
  const verdict = url.searchParams.get("verdict");
  if (verdict && (VERDICT as readonly string[]).includes(verdict)) {
    conds.push(
      eq(contactSubmission.spamVerdict, verdict as (typeof VERDICT)[number]),
    );
  }
  if (cur) {
    const cd = new Date(cur.c);
    conds.push(
      or(
        lt(contactSubmission.createdAt, cd),
        and(
          eq(contactSubmission.createdAt, cd),
          lt(contactSubmission.id, cur.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(contactSubmission)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(contactSubmission.createdAt), desc(contactSubmission.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeCursor({ c: last.createdAt.toISOString(), id: last.id })
      : null;

  return paginated(pageRows, { nextCursor, hasMore, limit });
}
