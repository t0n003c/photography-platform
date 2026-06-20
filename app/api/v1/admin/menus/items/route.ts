import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { menu, menuItem } from "@/src/db/schema";
import { invalidateMenu } from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  menuId: z.string(),
  label: z.string().min(1).max(120),
  linkType: z.enum(["page", "category", "location", "gallery", "url", "home", "none"]),
  targetId: z.string().nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  parentId: z.string().nullable().optional(),
  openInNewTab: z.boolean().optional(),
});

// POST — create a menu item.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const m = await db.select().from(menu).where(eq(menu.id, body.menuId)).limit(1);
  if (!m[0]) return problem(422, "INVALID_MENU", "Menu does not exist.");

  // Link-type-specific requirements.
  if (body.linkType === "url" && !body.url) {
    return problem(422, "URL_REQUIRED", "A URL is required for URL links.");
  }
  if (
    ["page", "category", "location", "gallery"].includes(body.linkType) &&
    !body.targetId
  ) {
    return problem(422, "TARGET_REQUIRED", "Pick what this item links to.");
  }
  if (body.parentId) {
    const parent = await db
      .select({ id: menuItem.id, menuId: menuItem.menuId })
      .from(menuItem)
      .where(eq(menuItem.id, body.parentId))
      .limit(1);
    if (!parent[0] || parent[0].menuId !== body.menuId) {
      return problem(422, "INVALID_PARENT", "Parent must be in the same menu.");
    }
  }

  const id = newId();
  await db.insert(menuItem).values({
    id,
    menuId: body.menuId,
    parentId: body.parentId ?? null,
    label: body.label,
    linkType: body.linkType,
    targetId: body.targetId ?? null,
    url: body.url ?? null,
    openInNewTab: body.openInNewTab ?? false,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu_item.create",
    entityType: "menu_item",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { menuId: body.menuId, linkType: body.linkType },
  });

  await invalidateMenu("primary");
  await invalidateMenu("footer");
  return created({ id });
}
