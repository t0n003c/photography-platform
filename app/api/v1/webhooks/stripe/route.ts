import { ok, problem } from "@/src/lib/http";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import { enqueueEmail } from "@/src/email/send";
import { storeReceiptIssued } from "@/src/email/templates";
import {
  getSiteSettings,
  getResolvedStorePaymentConfig,
} from "@/src/db/queries/settings";
import {
  recordStripeRefundUpdated,
  recordStripeCheckoutExpired,
  recordStripeCheckoutPaid,
} from "@/src/db/queries/orders";
import {
  beginStripeWebhookEvent,
  finishStripeWebhookEvent,
} from "@/src/db/queries/payment-events";
import {
  type StripeCheckoutSessionEvent,
  type StripeRefundEvent,
  type StripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "@/src/payments/stripe-webhook";
import { stripeRefundStatusToPaymentStatus } from "@/src/payments";
import { getEnv } from "@/src/lib/env";
import { orderStatusUrl } from "@/src/lib/order-status";

export const dynamic = "force-dynamic";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sessionObject(event: StripeCheckoutSessionEvent) {
  return event.data.object;
}

function refundObject(event: StripeRefundEvent) {
  return event.data.object;
}

function isRefundEvent(event: StripeWebhookEvent): event is StripeRefundEvent {
  return event.type === "charge.refund.updated" || event.type.startsWith("refund.");
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
  if (!verifyStripeWebhookSignature(payload, signature, config.stripeWebhookSecret)) {
    return problem(400, "INVALID_STRIPE_SIGNATURE", "Invalid Stripe signature.");
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(payload) as StripeWebhookEvent;
  } catch {
    return problem(400, "INVALID_STRIPE_EVENT", "Stripe event payload is invalid.");
  }
  if (!event.id) {
    return problem(400, "INVALID_STRIPE_EVENT", "Stripe event id is missing.");
  }

  const eventRef = isRefundEvent(event)
    ? {
        invoiceId: refundObject(event).metadata?.invoiceId ?? null,
        sessionId: null,
        paymentIntentId: refundObject(event).payment_intent ?? null,
      }
    : {
        invoiceId:
          sessionObject(event as StripeCheckoutSessionEvent).metadata?.invoiceId ??
          null,
        sessionId: sessionObject(event as StripeCheckoutSessionEvent).id ?? null,
        paymentIntentId:
          sessionObject(event as StripeCheckoutSessionEvent).payment_intent ?? null,
      };
  const eventState = await beginStripeWebhookEvent({
    id: event.id,
    type: event.type,
    livemode: event.livemode ?? null,
    apiVersion: event.api_version ?? null,
    ...eventRef,
  });
  if (eventState.action === "skip") {
    return ok({
      received: true,
      duplicate: true,
      status: eventState.status,
    });
  }

  try {
    let ignored: string | null = null;
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = sessionObject(event as StripeCheckoutSessionEvent);
      if (session.payment_status && session.payment_status !== "paid") {
        ignored = "payment_not_paid";
      } else if (!session.id) {
        ignored = "missing_session_id";
      } else {
        const result = await recordStripeCheckoutPaid({
          invoiceId: session.metadata?.invoiceId ?? null,
          sessionId: session.id,
          paymentIntentId: session.payment_intent ?? null,
          amountPaidCents: session.amount_total ?? null,
          amountTaxCents: session.total_details?.amount_tax ?? null,
          automaticTaxEnabled: session.automatic_tax?.enabled ?? false,
        });
        if (!result) {
          ignored = "invoice_not_found";
        } else if (!result.wasAlreadyPaid && result.order.email) {
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
              statusUrl: orderStatusUrl(issueOrderStatusToken(result.order.id)),
              siteName: settings.siteTitle,
            }),
          );
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = sessionObject(event as StripeCheckoutSessionEvent);
      if (!session.id) {
        ignored = "missing_session_id";
      } else {
        await recordStripeCheckoutExpired({
          invoiceId: session.metadata?.invoiceId ?? null,
          sessionId: session.id,
        });
      }
    } else if (isRefundEvent(event)) {
      const refund = refundObject(event);
      if (!refund.id) {
        ignored = "missing_refund_id";
      } else {
        const result = await recordStripeRefundUpdated({
          providerRefundId: refund.id,
          status: stripeRefundStatusToPaymentStatus(refund.status),
          providerError: refund.failure_reason ?? null,
          invoiceId: refund.metadata?.invoiceId ?? null,
          paymentIntentId: refund.payment_intent ?? null,
          refundedAt: refund.created ? new Date(refund.created * 1000) : null,
        });
        if (!result) ignored = "refund_not_found";
      }
    } else {
      ignored = "unhandled_event_type";
    }

    await finishStripeWebhookEvent(
      event.id,
      ignored ? "ignored" : "processed",
      eventRef,
    );
    return ok({ received: true, ...(ignored ? { ignored } : {}) });
  } catch (err) {
    await finishStripeWebhookEvent(event.id, "failed", {
      ...eventRef,
      error: err instanceof Error ? err.message : "Webhook processing failed.",
    });
    return problem(500, "STRIPE_WEBHOOK_FAILED", "Stripe webhook processing failed.");
  }
}
