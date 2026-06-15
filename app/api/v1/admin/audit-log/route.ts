import { and, desc, eq, lt, or } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { paginated } from "@/src/lib/http";
import { clampLimit, decodeCursor, encodeCursor } from "@/src/lib/cursor";
import { db } from "@/src/db/client";
import { auditLog } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/audit-log — cursor list (filters: actorId, action,
// entityType, entityId), createdAt+id descending.
export async function GET(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const cur = decodeCursor<{ c: string; id: string }>(
    url.searchParams.get("cursor"),
  );

  const conds = [];
  const actorId = url.searchParams.get("actorId");
  if (actorId) conds.push(eq(auditLog.actorId, actorId));
  const action = url.searchParams.get("action");
  if (action) conds.push(eq(auditLog.action, action));
  const entityType = url.searchParams.get("entityType");
  if (entityType) conds.push(eq(auditLog.entityType, entityType));
  const entityId = url.searchParams.get("entityId");
  if (entityId) conds.push(eq(auditLog.entityId, entityId));
  if (cur) {
    const cd = new Date(cur.c);
    conds.push(
      or(
        lt(auditLog.createdAt, cd),
        and(eq(auditLog.createdAt, cd), lt(auditLog.id, cur.id)),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
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
