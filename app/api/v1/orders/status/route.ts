import { z } from "zod";
import { issueOrderStatusToken, verifyOrderStatusToken } from "@/src/auth/order-status-token";
import {
  findPublicOrderStatusByLookup,
  getPublicOrderStatusById,
} from "@/src/db/queries/orders";
import { ok, parseJson, problem } from "@/src/lib/http";
import { orderStatusUrl } from "@/src/lib/order-status";

export const dynamic = "force-dynamic";

const LookupSchema = z.object({
  email: z.string().email(),
  reference: z.string().min(4).max(120),
});

function statusPayload(order: NonNullable<Awaited<ReturnType<typeof getPublicOrderStatusById>>>) {
  const token = issueOrderStatusToken(order.id);
  return {
    order,
    statusUrl: orderStatusUrl(token),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim();
  if (!token) {
    return problem(422, "STATUS_TOKEN_REQUIRED", "A status token is required.");
  }

  const orderId = verifyOrderStatusToken(token);
  if (!orderId) {
    return problem(404, "ORDER_STATUS_NOT_FOUND", "Order status could not be found.");
  }

  const order = await getPublicOrderStatusById(orderId);
  if (!order) {
    return problem(404, "ORDER_STATUS_NOT_FOUND", "Order status could not be found.");
  }

  return ok({ data: statusPayload(order) });
}

export async function POST(req: Request) {
  const parsed = await parseJson(req, LookupSchema);
  if ("error" in parsed) return parsed.error;

  const order = await findPublicOrderStatusByLookup(parsed.data);
  if (!order) {
    return problem(
      404,
      "ORDER_STATUS_NOT_FOUND",
      "We could not find an order with that email and reference.",
    );
  }

  return ok({ data: statusPayload(order) });
}
