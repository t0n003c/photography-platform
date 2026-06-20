import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, noContent, notFound, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import {
  renameMenu,
  activateMenu,
  deleteMenuPreset,
  invalidateMenu,
} from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  isActive: z.literal(true).optional(), // only activation is meaningful here
});

// PATCH — rename a preset and/or make it the active one for its role.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const { name, isActive } = parsed.data;

  if (name !== undefined) await renameMenu(id, name.trim());

  let role: "primary" | "footer" | null = null;
  if (isActive) {
    role = await activateMenu(id);
    if (!role) return notFound();
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu.update",
    entityType: "menu",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { renamed: name !== undefined, activated: Boolean(isActive) },
  });

  // Refresh both caches (activation can change the live menu for the role).
  await invalidateMenu("primary");
  await invalidateMenu("footer");
  return ok({ id });
}

// DELETE — remove a preset (items cascade). Refuses the active or last preset.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const res = await deleteMenuPreset(id);
  if (!res.ok) {
    if (res.reason === "NOT_FOUND") return notFound();
    if (res.reason === "ACTIVE")
      return problem(409, "MENU_ACTIVE", "Activate another preset before deleting this one.");
    if (res.reason === "ONLY")
      return problem(409, "MENU_ONLY", "A role must keep at least one preset.");
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu.delete",
    entityType: "menu",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  if (res.role) await invalidateMenu(res.role);
  return noContent();
}
