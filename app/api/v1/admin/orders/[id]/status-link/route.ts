import { requireRole } from "@/src/auth/session";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import { getOrderAdmin } from "@/src/db/queries/orders";
import { notFound, ok } from "@/src/lib/http";
import { orderStatusUrl } from "@/src/lib/order-status";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const order = await getOrderAdmin(id);
  if (!order) return notFound();

  return ok({
    data: {
      statusUrl: orderStatusUrl(issueOrderStatusToken(order.id)),
    },
  });
}
