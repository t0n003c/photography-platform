import type {
  CreateCheckoutInput,
  CreateRefundInput,
  CheckoutSession,
  PaymentRefund,
  PaymentRefundStatus,
  PaymentProvider,
} from "@/src/payments/provider";
import { PaymentProviderError } from "@/src/payments/provider";

interface StripePaymentProviderOptions {
  secretKey: string;
  statementDescriptor?: string | null;
}

export function stripeRefundStatusToPaymentStatus(
  status: string | null | undefined,
): PaymentRefundStatus {
  if (status === "succeeded") return "succeeded";
  if (status === "failed") return "failed";
  if (status === "canceled" || status === "cancelled") return "cancelled";
  return "pending";
}

function stripeRefundReason(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, "_");
  if (
    normalized === "duplicate" ||
    normalized === "fraudulent" ||
    normalized === "requested_by_customer"
  ) {
    return normalized;
  }
  return null;
}

function metadataValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, 500);
}

export class StripePaymentProvider implements PaymentProvider {
  constructor(private readonly opts: StripePaymentProviderOptions) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", input.successUrl);
    params.set("cancel_url", input.cancelUrl);
    params.set("client_reference_id", input.invoiceId);

    if (input.customerEmail) {
      params.set("customer_email", input.customerEmail);
    }

    for (const [key, value] of Object.entries({
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      ...input.metadata,
    })) {
      if (value === null || value === undefined) continue;
      params.set(`metadata[${key}]`, String(value));
      params.set(`payment_intent_data[metadata][${key}]`, String(value));
    }

    const descriptor = input.metadata?.statementDescriptor
      ? String(input.metadata.statementDescriptor)
      : this.opts.statementDescriptor;
    if (descriptor) {
      params.set("payment_intent_data[statement_descriptor]", descriptor.slice(0, 22));
    }

    input.lineItems.forEach((item, index) => {
      params.set(`line_items[${index}][quantity]`, String(item.quantity));
      params.set(
        `line_items[${index}][price_data][currency]`,
        input.currency.toLowerCase(),
      );
      params.set(
        `line_items[${index}][price_data][unit_amount]`,
        String(item.amountCents),
      );
      params.set(
        `line_items[${index}][price_data][product_data][name]`,
        item.description.slice(0, 250),
      );
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `invoice-checkout-${input.invoiceId}`,
      },
      body: params,
    });

    const body = (await res.json().catch(() => null)) as
      | {
          id?: string;
          url?: string;
          payment_intent?: string | null;
          expires_at?: number | null;
          error?: { message?: string };
        }
      | null;

    if (!res.ok || !body?.id || !body.url) {
      throw new PaymentProviderError(
        body?.error?.message || "Stripe could not create a checkout session.",
        "STRIPE_CHECKOUT_FAILED",
      );
    }

    return {
      id: body.id,
      url: body.url,
      paymentIntentId: body.payment_intent ?? null,
      expiresAt: body.expires_at ? new Date(body.expires_at * 1000) : null,
    };
  }

  async createRefund(input: CreateRefundInput): Promise<PaymentRefund> {
    const params = new URLSearchParams();
    params.set("payment_intent", input.paymentIntentId);
    params.set("amount", String(input.amountCents));

    const reason = stripeRefundReason(input.reason);
    if (reason) params.set("reason", reason);

    for (const [key, value] of Object.entries({
      orderId: input.orderId,
      invoiceId: input.invoiceId,
      localRefundId: input.refundId,
      appReason: input.reason,
      note: input.note,
      ...input.metadata,
    })) {
      const normalized = metadataValue(value);
      if (normalized === null) continue;
      params.set(`metadata[${key}]`, normalized);
    }

    const res = await fetch("https://api.stripe.com/v1/refunds", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `order-refund-${input.refundId}`,
      },
      body: params,
    });

    const body = (await res.json().catch(() => null)) as
      | {
          id?: string;
          amount?: number | null;
          currency?: string | null;
          status?: string | null;
          failure_reason?: string | null;
          created?: number | null;
          error?: { message?: string; code?: string };
        }
      | null;

    if (!res.ok || !body?.id) {
      throw new PaymentProviderError(
        body?.error?.message || "Stripe could not create the refund.",
        body?.error?.code || "STRIPE_REFUND_FAILED",
      );
    }

    return {
      id: body.id,
      amountCents: body.amount ?? input.amountCents,
      currency: (body.currency ?? input.currency).toUpperCase(),
      status: stripeRefundStatusToPaymentStatus(body.status),
      providerStatus: body.status ?? null,
      failureReason: body.failure_reason ?? null,
      createdAt: body.created ? new Date(body.created * 1000) : null,
    };
  }
}
