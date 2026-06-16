import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, noContent, notFound, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { folder } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

async function load(id: string) {
  const rows = await db.select().from(folder).where(eq(folder.id, id)).limit(1);
  return rows[0] ?? null;
}

// Would moving `id` under `newParent` create a cycle?
async function wouldCycle(id: string, newParent: string): Promise<boolean> {
  const all = await db
    .select({ id: folder.id, parentId: folder.parentId })
    .from(folder);
  const parentOf = new Map(all.map((f) => [f.id, f.parentId]));
  let cur: string | null = newParent;
  while (cur) {
    if (cur === id) return true;
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const f = await load(id);
  if (!f) return notFound();
  return ok(f);
}

// PATCH — rename, move (parentId), or reorder.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const f = await load(id);
  if (!f) return notFound();

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id) {
      return problem(422, "INVALID_PARENT", "A folder cannot be its own parent.");
    }
    if (await wouldCycle(id, body.parentId)) {
      return problem(422, "INVALID_PARENT", "Cannot move a folder into its own descendant.");
    }
  }

  const updates: Partial<typeof folder.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.parentId !== undefined) updates.parentId = body.parentId;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  await db.update(folder).set(updates).where(eq(folder.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.update",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — removes the folder and (via FK cascade) its subfolders + memberships.
// Photos themselves are untouched.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const f = await load(id);
  if (!f) return notFound();

  await db.delete(folder).where(eq(folder.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.delete",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
