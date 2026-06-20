import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, created, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import {
  listMenusForAdmin,
  createMenuPreset,
  invalidateMenu,
} from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

// GET — all menus (presets) with their items (flat, parentId-linked).
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const menus = await listMenusForAdmin();
  return ok({ data: menus });
}

const CreateSchema = z.object({
  role: z.enum(["primary", "footer"]),
  name: z.string().min(1).max(120),
});

// POST — create a new (empty, inactive) menu preset for a role.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const { role, name } = parsed.data;

  const id = await createMenuPreset(role, name.trim());

  await writeAudit({
    actorId: a.session.user.id,
    action: "menu.create",
    entityType: "menu",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { role, name },
  });

  await invalidateMenu(role);
  return created({ id });
}
