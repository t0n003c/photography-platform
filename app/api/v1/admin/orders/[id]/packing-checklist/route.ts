import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import {
  getOrderAdmin,
  updateOrderPackingChecklistAdmin,
} from "@/src/db/queries/orders";
import { writeAudit } from "@/src/lib/audit";
import { notFound, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const PackingChecklistSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1).max(80),
        checked: z.boolean(),
      }),
    )
    .max(200),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getOrderAdmin(id);
  if (!current) return notFound();

  const parsed = await parseJson(req, PackingChecklistSchema);
  if ("error" in parsed) return parsed.error;

  const order = await updateOrderPackingChecklistAdmin(
    id,
    parsed.data.items,
    a.session.user.id,
  );
  if (!order) return notFound();

  const packedCount = order.packingChecklist.filter((item) => item.checked).length;
  await writeAudit({
    actorId: a.session.user.id,
    action: "order.packing_checklist.update",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: {
      packedCount,
      itemCount: order.items.length,
      previousPackedCount: current.packingChecklist.filter((item) => item.checked)
        .length,
    },
  });

  return ok({ data: order });
}
