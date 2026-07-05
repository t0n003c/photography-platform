import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { notFound, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import {
  getOrderAdmin,
  updateOrderStatusAdmin,
  type OrderStatus,
} from "@/src/db/queries/orders";

export const dynamic = "force-dynamic";

const StatusSchema = z.object({
  status: z.enum(["draft", "pending", "paid", "fulfilled", "cancelled"]),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await getOrderAdmin(id);
  if (!row) return notFound();
  return ok({ data: row });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getOrderAdmin(id);
  if (!current) return notFound();

  const parsed = await parseJson(req, StatusSchema);
  if ("error" in parsed) return parsed.error;
  const nextStatus = parsed.data.status as OrderStatus;

  const row = await updateOrderStatusAdmin(id, nextStatus);
  if (!row) return notFound();

  await writeAudit({
    actorId: a.session.user.id,
    action: "order.status.update",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { from: current.status, to: nextStatus },
  });

  return ok({ data: row });
}
