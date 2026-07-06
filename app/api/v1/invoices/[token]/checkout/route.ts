import { getEnv } from "@/src/lib/env";
import { ok, problem } from "@/src/lib/http";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import {
  attachInvoiceOnlineCheckoutSession,
  getPublicInvoiceByToken,
} from "@/src/db/queries/orders";
import { getStorePaymentSettings } from "@/src/db/queries/settings";
import { getPaymentProvider, PaymentProviderError } from "@/src/payments";
import {
  checkoutLineItemsFromOrder,
  checkoutLineItemsTotal,
} from "@/src/payments/store-line-items";
import type { StoreInvoiceTaxMode } from "@/src/lib/store-settings";

export const dynamic = "force-dynamic";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function invoiceUrl(token: string, suffix: string) {
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

  const paymentSettings = await getStorePaymentSettings();
  const taxMode = data.invoice.onlinePaymentTaxMode;
  const lineItems = checkoutLineItemsFromOrder(data.order, {
    taxMode,
    shippingTaxCode:
      taxMode === "stripe" ? paymentSettings.stripeShippingTaxCode : null,
  });
  if (
    checkoutLineItemsTotal(lineItems) !==
    expectedInvoiceCheckoutTotal(
      data.invoice.amountCents,
      data.order.taxCents,
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
    const signedToken = issueInvoiceToken(data.invoice.id);
    const session = await provider.createCheckout({
      orderId: data.order.id,
      invoiceId: data.invoice.id,
      customerEmail: data.order.email,
      currency: data.invoice.currency,
      lineItems,
      successUrl: invoiceUrl(signedToken, "?payment=success"),
      cancelUrl: invoiceUrl(signedToken, "?payment=cancelled"),
      automaticTax: taxMode === "stripe",
      metadata: {
        source: "invoice",
        taxMode,
        orderId: data.order.id,
        invoiceId: data.invoice.id,
      },
    });
    await attachInvoiceOnlineCheckoutSession(data.invoice.id, session, taxMode);
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
