import { z } from "zod";
import { created, parseJson, problem } from "@/src/lib/http";
import { isPaymentsEnabled } from "@/src/payments";
import { createManualCheckoutOrder } from "@/src/db/queries/orders";
import { resolveCartItems } from "@/src/db/queries/store";
import { enqueueEmail } from "@/src/email/send";
import {
  manualOrderAdminNotification,
  manualOrderCustomerConfirmation,
} from "@/src/email/templates";
import { getEnv } from "@/src/lib/env";
import { getSiteSettings } from "@/src/db/queries/settings";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";

export const dynamic = "force-dynamic";

const CheckoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  options: z.record(z.string(), z.string()).optional(),
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

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function buildConfirmation(opts: {
  order: Awaited<ReturnType<typeof createManualCheckoutOrder>>;
  summary: Awaited<ReturnType<typeof resolveCartItems>>;
  customer: z.infer<typeof CheckoutSchema>["customer"];
}): StoreOrderConfirmation {
  const receiptUrl = `/cart/confirmation?order=${encodeURIComponent(
    opts.order.orderId,
  )}`;
  return {
    orderId: opts.order.orderId,
    status: opts.order.status,
    customerName: opts.customer.name?.trim() || null,
    customerEmail: opts.customer.email.trim().toLowerCase(),
    subtotalCents: opts.order.subtotalCents,
    totalCents: opts.order.totalCents,
    currency: opts.order.currency,
    itemCount: opts.order.itemCount,
    createdAt: opts.order.createdAt,
    receiptUrl,
    lines: opts.summary.lines.map((line) => ({
      productId: line.product.id,
      productSlug: line.product.slug,
      productName: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      selectedOptions: line.selectedOptions,
    })),
  };
}

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
  if (summary.optionErrors.length > 0) {
    return problem(
      409,
      "PRODUCT_OPTIONS_REQUIRED",
      "One or more products need an updated option choice before checkout.",
      {
        details: summary.optionErrors.map((error) => ({
          field: "items",
          issue: error.message,
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
  const env = getEnv();
  const baseUrl = trimSlash(env.APP_BASE_URL);
  const adminNotifyTo = env.CONTACT_NOTIFY_EMAIL?.trim() || env.EMAIL_FROM;
  const confirmation = buildConfirmation({
    order,
    summary,
    customer: parsed.data.customer,
  });
  const settings = await getSiteSettings();

  await enqueueEmail(
    manualOrderCustomerConfirmation({
      to: confirmation.customerEmail,
      order: confirmation,
      siteName: settings.siteTitle,
    }),
  );
  await enqueueEmail(
    manualOrderAdminNotification({
      to: adminNotifyTo,
      order: confirmation,
      adminUrl: `${baseUrl}/admin/store`,
    }),
  );

  return created({
    data: confirmation,
    message: "Order request received. A manual invoice can be sent for this order.",
  });
}
