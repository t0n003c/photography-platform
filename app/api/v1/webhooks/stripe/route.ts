import { ok, problem } from "@/src/lib/http";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { enqueueEmail } from "@/src/email/send";
import { storeReceiptIssued } from "@/src/email/templates";
import { getSiteSettings, getResolvedStorePaymentConfig } from "@/src/db/queries/settings";
import {
  recordStripeCheckoutExpired,
  recordStripeCheckoutPaid,
} from "@/src/db/queries/orders";
import {
  type StripeCheckoutSessionEvent,
  verifyStripeWebhookSignature,
} from "@/src/payments/stripe-webhook";
import { getEnv } from "@/src/lib/env";

export const dynamic = "force-dynamic";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sessionObject(event: StripeCheckoutSessionEvent) {
  return event.data.object;
}

export async function POST(req: Request) {
  const config = await getResolvedStorePaymentConfig();
  if (!config.stripeWebhookSecret) {
    return problem(
      503,
      "STRIPE_WEBHOOK_NOT_CONFIGURED",
      "Stripe webhook secret is not configured.",
    );
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (
    !verifyStripeWebhookSignature(payload, signature, config.stripeWebhookSecret)
  ) {
    return problem(400, "INVALID_STRIPE_SIGNATURE", "Invalid Stripe signature.");
  }

  let event: StripeCheckoutSessionEvent;
  try {
    event = JSON.parse(payload) as StripeCheckoutSessionEvent;
  } catch {
    return problem(400, "INVALID_STRIPE_EVENT", "Stripe event payload is invalid.");
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = sessionObject(event);
    if (session.payment_status && session.payment_status !== "paid") {
      return ok({ received: true, ignored: "payment_not_paid" });
    }
    if (!session.id) {
      return ok({ received: true, ignored: "missing_session_id" });
    }
    const result = await recordStripeCheckoutPaid({
      invoiceId: session.metadata?.invoiceId ?? null,
      sessionId: session.id,
      paymentIntentId: session.payment_intent ?? null,
      amountPaidCents: session.amount_total ?? null,
    });
    if (result && !result.wasAlreadyPaid && result.order.email) {
      const settings = await getSiteSettings();
      const token = issueInvoiceToken(result.invoice.id);
      await enqueueEmail(
        storeReceiptIssued({
          to: result.order.email,
          order: result.order,
          invoice: result.invoice,
          receiptUrl: `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(
            token,
          )}`,
          siteName: settings.siteTitle,
        }),
      );
    }
  } else if (event.type === "checkout.session.expired") {
    const session = sessionObject(event);
    if (!session.id) {
      return ok({ received: true, ignored: "missing_session_id" });
    }
    await recordStripeCheckoutExpired({
      invoiceId: session.metadata?.invoiceId ?? null,
      sessionId: session.id,
    });
  }

  return ok({ received: true });
}
