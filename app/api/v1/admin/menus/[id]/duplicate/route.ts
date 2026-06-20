import { requireRole } from "@/src/auth/session";
import { created, notFound } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { duplicateMenu, invalidateMenu } from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

// POST — deep-copy a preset (items + hierarchy) into a new inactive preset.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const res = await duplicateMenu(id);
  if (!res) return notFound();

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu.duplicate",
    entityType: "menu",
    entityId: res.id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { from: id },
  });

  await invalidateMenu(res.role);
  return created({ id: res.id });
}
