import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, noContent, notFound, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { menuItem } from "@/src/db/schema";
import { invalidateMenu } from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  linkType: z
    .enum(["page", "category", "location", "gallery", "url", "home", "none"])
    .optional(),
  targetId: z.string().nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  openInNewTab: z.boolean().optional(),
  isVisible: z.boolean().optional(),
});

async function load(id: string) {
  const rows = await db.select().from(menuItem).where(eq(menuItem.id, id)).limit(1);
  return rows[0] ?? null;
}

// Would re-parenting `id` under `newParent` create a cycle within the menu?
async function wouldCycle(id: string, newParent: string): Promise<boolean> {
  const all = await db
    .select({ id: menuItem.id, parentId: menuItem.parentId })
    .from(menuItem);
  const parentOf = new Map(all.map((i) => [i.id, i.parentId]));
  let cur: string | null = newParent;
  while (cur) {
    if (cur === id) return true;
    cur = parentOf.get(cur) ?? null;
  }
  return false;
}

// PATCH — edit, move (parentId), reorder, toggle visibility.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const item = await load(id);
  if (!item) return notFound();

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (body.parentId !== undefined && body.parentId !== null) {
    if (body.parentId === id) {
      return problem(422, "INVALID_PARENT", "An item cannot be its own parent.");
    }
    const parent = await load(body.parentId);
    if (!parent || parent.menuId !== item.menuId) {
      return problem(422, "INVALID_PARENT", "Parent must be in the same menu.");
    }
    if (await wouldCycle(id, body.parentId)) {
      return problem(422, "INVALID_PARENT", "Cannot nest an item inside its own descendant.");
    }
  }

  const updates: Partial<typeof menuItem.$inferInsert> = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.linkType !== undefined) updates.linkType = body.linkType;
  if (body.targetId !== undefined) updates.targetId = body.targetId;
  if (body.url !== undefined) updates.url = body.url;
  if (body.parentId !== undefined) updates.parentId = body.parentId;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.openInNewTab !== undefined) updates.openInNewTab = body.openInNewTab;
  if (body.isVisible !== undefined) updates.isVisible = body.isVisible;

  await db.update(menuItem).set(updates).where(eq(menuItem.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu_item.update",
    entityType: "menu_item",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  await invalidateMenu("primary");
  await invalidateMenu("footer");
  return ok({ id });
}

// DELETE — removes the item and (via FK cascade) its descendants.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const item = await load(id);
  if (!item) return notFound();

  await db.delete(menuItem).where(eq(menuItem.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu_item.delete",
    entityType: "menu_item",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  await invalidateMenu("primary");
  await invalidateMenu("footer");
  return noContent();
}
