import { z } from "zod";
import { ok, parseJson } from "@/src/lib/http";
import { resolveCartItems } from "@/src/db/queries/store";

export const dynamic = "force-dynamic";

const CartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

const CartSchema = z.object({
  items: z.array(CartItemSchema).max(50).default([]),
});

// POST /api/v1/cart — resolve browser-local cart contents against active
// products and current pricing. This does not persist cart state server-side.
export async function POST(req: Request) {
  const parsed = await parseJson(req, CartSchema);
  if ("error" in parsed) return parsed.error;
  const data = await resolveCartItems(parsed.data.items);
  return ok({ data });
}
