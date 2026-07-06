import { z } from "zod";
import { created, parseJson, problem } from "@/src/lib/http";
import { getPaymentProvider, PaymentProviderError } from "@/src/payments";
import {
  createHostedCheckoutOrder,
  createHostedCheckoutRefs,
  createManualCheckoutOrder,
} from "@/src/db/queries/orders";
import { resolveCartItems } from "@/src/db/queries/store";
import { enqueueEmail } from "@/src/email/send";
import {
  manualOrderAdminNotification,
  manualOrderCustomerConfirmation,
} from "@/src/email/templates";
import { getEnv } from "@/src/lib/env";
import { getSiteSettings, getStoreCheckoutSettings } from "@/src/db/queries/settings";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";
import {
  checkoutLineItemsFromCartSummary,
  checkoutLineItemsTotal,
} from "@/src/payments/store-line-items";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import { orderStatusPath } from "@/src/lib/order-status";

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
  shippingProfileId: z.string().max(80).nullable().optional(),
  promoCode: z.string().max(40).nullable().optional(),
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
  const statusUrl = orderStatusPath(issueOrderStatusToken(opts.order.orderId));
  return {
    orderId: opts.order.orderId,
    status: opts.order.status,
    customerName: opts.customer.name?.trim() || null,
    customerEmail: opts.customer.email.trim().toLowerCase(),
    subtotalCents: opts.order.subtotalCents,
    taxCents: opts.order.taxCents,
    shippingCents: opts.order.shippingCents,
    discountCents: opts.order.discountCents,
    promoCode: opts.order.promoCode,
    shippingProfileLabel: opts.order.shippingProfileLabel,
    totalCents: opts.order.totalCents,
    currency: opts.order.currency,
    itemCount: opts.order.itemCount,
    createdAt: opts.order.createdAt,
    receiptUrl,
    statusUrl,
    checkoutSettings: opts.order.checkoutSettings,
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

function checkoutUrlFor(token: string, suffix: string) {
  return `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(token)}${suffix}`;
}

// POST /api/v1/checkout — creates a pending manual-invoice order by default,
// or a hosted Stripe Checkout session when Settings -> Payments is ready.
export async function POST(req: Request) {
  const parsed = await parseJson(req, CheckoutSchema);
  if ("error" in parsed) return parsed.error;

  const summary = await resolveCartItems(parsed.data.items, {
    shippingProfileId: parsed.data.shippingProfileId,
    promoCode: parsed.data.promoCode,
  });
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
  if (summary.availabilityErrors.length > 0) {
    return problem(
      409,
      "PRODUCT_OUT_OF_STOCK",
      summary.availabilityErrors.map((error) => error.message).join(" "),
      {
        details: summary.availabilityErrors.map((error) => ({
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
  if (summary.promoError) {
    return problem(409, "PROMO_CODE_INVALID", summary.promoError, {
      details: [{ field: "promoCode", issue: summary.promoError }],
    });
  }

  if (summary.payment.hostedCheckoutAvailable) {
    const refs = createHostedCheckoutRefs();
    const invoiceToken = issueInvoiceToken(refs.invoiceId);
    const lineItems = checkoutLineItemsFromCartSummary(summary);
    if (checkoutLineItemsTotal(lineItems) !== summary.totalCents) {
      return problem(
        500,
        "CHECKOUT_TOTAL_MISMATCH",
        "Checkout totals could not be prepared.",
      );
    }
    try {
      const provider = await getPaymentProvider();
      const session = await provider.createCheckout({
        orderId: refs.orderId,
        invoiceId: refs.invoiceId,
        customerEmail: parsed.data.customer.email.trim().toLowerCase(),
        currency: summary.currency,
        lineItems,
        successUrl: checkoutUrlFor(invoiceToken, "?payment=success"),
        cancelUrl: checkoutUrlFor(invoiceToken, "?payment=cancelled"),
        automaticTax: summary.payment.taxMode === "stripe",
        metadata: {
          source: "cart",
          taxMode: summary.payment.taxMode,
          orderId: refs.orderId,
          invoiceId: refs.invoiceId,
        },
      });
      const order = await createHostedCheckoutOrder(
        summary,
        parsed.data.customer,
        refs,
        session,
      );
      const confirmation = buildConfirmation({
        order,
        summary,
        customer: parsed.data.customer,
      });
      return created({
        data: {
          ...confirmation,
          receiptUrl: `/invoice/${encodeURIComponent(invoiceToken)}`,
          checkoutUrl: session.url,
        },
        message: "Stripe checkout session created.",
      });
    } catch (err) {
      if (err instanceof PaymentProviderError) {
        return problem(502, err.code, err.message);
      }
      return problem(502, "PAYMENT_PROVIDER_ERROR", "Could not start checkout.");
    }
  }

  const order = await createManualCheckoutOrder(summary, parsed.data.customer);
  const env = getEnv();
  const baseUrl = trimSlash(env.APP_BASE_URL);
  const storeSettings = await getStoreCheckoutSettings();
  const adminNotifyTo =
    storeSettings.notifyEmail?.trim() ||
    env.CONTACT_NOTIFY_EMAIL?.trim() ||
    env.EMAIL_FROM;
  const confirmation = buildConfirmation({
    order,
    summary,
    customer: parsed.data.customer,
  });
  const emailConfirmation = {
    ...confirmation,
    statusUrl: confirmation.statusUrl
      ? `${baseUrl}${confirmation.statusUrl}`
      : confirmation.statusUrl,
  };
  const settings = await getSiteSettings();

  await enqueueEmail(
    manualOrderCustomerConfirmation({
      to: emailConfirmation.customerEmail,
      order: emailConfirmation,
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
