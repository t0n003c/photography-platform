import { z } from "zod";
import { created, parseJson, problem } from "@/src/lib/http";
import { isPaymentsEnabled } from "@/src/payments";
import { createManualCheckoutOrder } from "@/src/db/queries/orders";
import { resolveCartItems } from "@/src/db/queries/store";

export const dynamic = "force-dynamic";

const CheckoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

const CheckoutSchema = z.object({
  customer: z.object({
    name: z.string().max(160).optional(),
    email: z.string().email(),
    phone: z.string().max(80).optional(),
    notes: z.string().max(1000).optional(),
  }),
  items: z.array(CheckoutItemSchema).min(1).max(50),
});

// POST /api/v1/checkout — creates a pending manual-invoice order while the
// PaymentProvider seam is stubbed. A real driver can replace the enabled branch
// with getPaymentProvider().createCheckout(...).
export async function POST(req: Request) {
  const parsed = await parseJson(req, CheckoutSchema);
  if ("error" in parsed) return parsed.error;

  const summary = await resolveCartItems(parsed.data.items);
  if (summary.lines.length === 0) {
    return problem(422, "EMPTY_CART", "Add at least one available product first.");
  }
  if (summary.unavailableProductIds.length > 0) {
    return problem(
      409,
      "PRODUCT_UNAVAILABLE",
      "One or more products in the cart are no longer available.",
      {
        details: summary.unavailableProductIds.map((id) => ({
          field: "items",
          issue: id,
        })),
      },
    );
  }
  if (summary.hasMixedCurrency) {
    return problem(
      422,
      "MIXED_CURRENCY_CART",
      "Products with different currencies cannot be checked out together yet.",
    );
  }

  if (isPaymentsEnabled()) {
    return problem(
      501,
      "PAYMENT_CHECKOUT_NOT_WIRED",
      "Hosted checkout is not wired to the cart flow yet.",
    );
  }

  const order = await createManualCheckoutOrder(summary, parsed.data.customer);
  return created({
    data: order,
    message: "Order request received. A manual invoice can be sent for this order.",
  });
}
