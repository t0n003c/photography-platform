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
import { getEnv } from "@/src/lib/env";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { notFound, ok, problem, parseJson } from "@/src/lib/http";

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

  const lineItems = checkoutLineItemsFromOrder(current);
  if (checkoutLineItemsTotal(lineItems) !== current.invoice.amountCents) {
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
      metadata: {
        source: "admin-refresh",
        orderId: current.id,
        invoiceId: current.invoice.id,
      },
    });
    const order = await attachInvoiceOnlineCheckoutSession(
      current.invoice.id,
      session,
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
        openNow: parsed.data.openNow ?? false,
      },
    });

    return ok({
      data: {
        order,
        checkoutUrl: session.url,
        invoiceUrl: invoiceUrl(token),
      },
    });
  } catch (err) {
    if (err instanceof PaymentProviderError) {
      return problem(502, err.code, err.message);
    }
    return problem(502, "PAYMENT_PROVIDER_ERROR", "Could not start checkout.");
  }
}
