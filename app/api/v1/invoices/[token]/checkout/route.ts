import { getEnv } from "@/src/lib/env";
import { ok, problem } from "@/src/lib/http";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import {
  attachInvoiceOnlineCheckoutSession,
  getPublicInvoiceByToken,
} from "@/src/db/queries/orders";
import { getPaymentProvider, PaymentProviderError } from "@/src/payments";
import {
  checkoutLineItemsFromOrder,
  checkoutLineItemsTotal,
} from "@/src/payments/store-line-items";

export const dynamic = "force-dynamic";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function invoiceUrl(token: string, suffix: string) {
  return `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(token)}${suffix}`;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const data = await getPublicInvoiceByToken(token);
  if (!data) {
    return problem(404, "INVOICE_NOT_FOUND", "Invoice not found.");
  }
  if (data.invoice.status === "paid") {
    return problem(409, "INVOICE_ALREADY_PAID", "This invoice is already paid.");
  }
  if (data.invoice.amountCents <= 0) {
    return problem(422, "INVOICE_NOT_PAYABLE", "This invoice has no amount due.");
  }

  const lineItems = checkoutLineItemsFromOrder(data.order);
  if (checkoutLineItemsTotal(lineItems) !== data.invoice.amountCents) {
    return problem(
      500,
      "CHECKOUT_TOTAL_MISMATCH",
      "Invoice totals could not be prepared for checkout.",
    );
  }

  try {
    const provider = await getPaymentProvider();
    const signedToken = issueInvoiceToken(data.invoice.id);
    const session = await provider.createCheckout({
      orderId: data.order.id,
      invoiceId: data.invoice.id,
      customerEmail: data.order.email,
      currency: data.invoice.currency,
      lineItems,
      successUrl: invoiceUrl(signedToken, "?payment=success"),
      cancelUrl: invoiceUrl(signedToken, "?payment=cancelled"),
      metadata: {
        source: "invoice",
        orderId: data.order.id,
        invoiceId: data.invoice.id,
      },
    });
    await attachInvoiceOnlineCheckoutSession(data.invoice.id, session);
    return ok({
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  } catch (err) {
    if (err instanceof PaymentProviderError) {
      return problem(502, err.code, err.message);
    }
    return problem(502, "PAYMENT_PROVIDER_ERROR", "Could not start checkout.");
  }
}
