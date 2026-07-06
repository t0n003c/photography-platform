import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { getPaymentProvider, PaymentProviderError } from "@/src/payments";
import {
  checkoutLineItemsFromOrder,
  checkoutLineItemsTotal,
} from "@/src/payments/store-line-items";
import {
  attachInvoiceOnlineCheckoutSession,
  getOrderAdmin,
} from "@/src/db/queries/orders";
import { getStorePaymentSettings } from "@/src/db/queries/settings";
import { getEnv } from "@/src/lib/env";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { notFound, ok, problem, parseJson } from "@/src/lib/http";
import {
  effectiveInvoiceTaxMode,
  type StoreInvoiceTaxMode,
} from "@/src/lib/store-settings";

export const dynamic = "force-dynamic";

const RefreshCheckoutSchema = z.object({
  openNow: z.boolean().optional(),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function invoiceUrl(token: string, suffix = "") {
  return `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(token)}${suffix}`;
}

function expectedInvoiceCheckoutTotal(
  amountCents: number,
  taxCents: number,
  taxMode: StoreInvoiceTaxMode,
) {
  return taxMode === "stripe" ? Math.max(0, amountCents - taxCents) : amountCents;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const parsed = await parseJson(req, RefreshCheckoutSchema);
  if ("error" in parsed) return parsed.error;

  const current = await getOrderAdmin(id);
  if (!current) return notFound();
  if (!current.invoice) {
    return problem(404, "INVOICE_NOT_FOUND", "Create an invoice first.");
  }
  if (current.invoice.status === "paid") {
    return problem(409, "INVOICE_ALREADY_PAID", "This invoice is already paid.");
  }
  if (current.invoice.status !== "issued") {
    return problem(
      409,
      "INVOICE_NOT_ISSUED",
      "Send or issue this invoice before creating an online payment link.",
    );
  }
  if (current.invoice.amountCents <= 0) {
    return problem(422, "INVOICE_NOT_PAYABLE", "This invoice has no amount due.");
  }

  const paymentSettings = await getStorePaymentSettings();
  const taxMode = effectiveInvoiceTaxMode(paymentSettings);
  const lineItems = checkoutLineItemsFromOrder(current, {
    taxMode,
    shippingTaxCode:
      taxMode === "stripe" ? paymentSettings.stripeShippingTaxCode : null,
  });
  if (
    checkoutLineItemsTotal(lineItems) !==
    expectedInvoiceCheckoutTotal(
      current.invoice.amountCents,
      current.taxCents,
      taxMode,
    )
  ) {
    return problem(
      500,
      "CHECKOUT_TOTAL_MISMATCH",
      "Invoice totals could not be prepared for checkout.",
    );
  }

  try {
    const provider = await getPaymentProvider();
    const token = issueInvoiceToken(current.invoice.id);
    const session = await provider.createCheckout({
      orderId: current.id,
      invoiceId: current.invoice.id,
      customerEmail: current.email,
      currency: current.invoice.currency,
      lineItems,
      successUrl: invoiceUrl(token, "?payment=success"),
      cancelUrl: invoiceUrl(token, "?payment=cancelled"),
      automaticTax: taxMode === "stripe",
      metadata: {
        source: "admin-refresh",
        taxMode,
        orderId: current.id,
        invoiceId: current.invoice.id,
      },
    });
    const order = await attachInvoiceOnlineCheckoutSession(
      current.invoice.id,
      session,
      taxMode,
    );
    if (!order) return notFound();

    await writeAudit({
      actorId: a.session.user.id,
      action: "order.checkout.refresh",
      entityType: "order",
      entityId: current.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
      metadata: {
        invoiceId: current.invoice.id,
        invoiceNumber: current.invoice.number,
        sessionId: session.id,
        paymentIntentId: session.paymentIntentId,
        taxMode,
        openNow: parsed.data.openNow ?? false,
      },
    });

    return ok({
      data: {
        order,
        checkoutUrl: session.url,
        invoiceUrl: invoiceUrl(token),
        taxMode,
        warning:
          taxMode === "stripe"
            ? "Stripe Tax will recalculate tax at checkout. The paid receipt total may differ from the saved invoice estimate."
            : null,
      },
    });
  } catch (err) {
    if (err instanceof PaymentProviderError) {
      return problem(502, err.code, err.message);
    }
    return problem(502, "PAYMENT_PROVIDER_ERROR", "Could not start checkout.");
  }
}
