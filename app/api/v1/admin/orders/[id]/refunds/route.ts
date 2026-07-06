import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { enqueueEmail } from "@/src/email/send";
import { storeRefundIssued } from "@/src/email/templates";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import { getSiteSettings } from "@/src/db/queries/settings";
import {
  getOrderAdmin,
  recordOrderRefundAdmin,
  type RefundStatus,
} from "@/src/db/queries/orders";
import { getPaymentProvider, PaymentProviderError } from "@/src/payments";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { newId } from "@/src/lib/id";
import { orderStatusUrl } from "@/src/lib/order-status";
import { clientIp, userAgent } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const RefundSchema = z.object({
  amountCents: z.number().int().positive(),
  status: z
    .enum(["pending", "succeeded", "failed", "cancelled"])
    .default("succeeded"),
  provider: z.enum(["manual", "stripe"]).default("manual"),
  providerRefundId: z.string().max(200).nullable().optional(),
  method: z.string().max(80).nullable().optional(),
  reference: z.string().max(200).nullable().optional(),
  reason: z.string().max(240).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  refundedAt: z.string().max(40).nullable().optional(),
  sendEmail: z.boolean().default(false),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parseRefundDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function reservedRefundedCents(
  refunds: Array<{ amountCents: number; status: RefundStatus }>,
) {
  return refunds
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
}

function canEmailRefund(status: RefundStatus, sendEmail: boolean) {
  return sendEmail && status === "succeeded";
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getOrderAdmin(id);
  if (!current) return notFound();
  if (!current.invoice || current.invoice.status !== "paid") {
    return problem(
      409,
      "INVOICE_NOT_PAID",
      "Record payment before adding a refund.",
    );
  }

  const parsed = await parseJson(req, RefundSchema);
  if ("error" in parsed) return parsed.error;
  const refundedAt = parseRefundDate(parsed.data.refundedAt);
  if (parsed.data.refundedAt?.trim() && !refundedAt) {
    return problem(422, "INVALID_REFUND_DATE", "Refund date is invalid.");
  }
  if (
    parsed.data.provider === "manual" &&
    parsed.data.sendEmail &&
    parsed.data.status !== "succeeded"
  ) {
    return problem(
      422,
      "REFUND_EMAIL_NOT_AVAILABLE",
      "Refund emails can be sent only for successful refunds.",
    );
  }
  if (parsed.data.sendEmail && !current.email) {
    return problem(
      422,
      "ORDER_EMAIL_REQUIRED",
      "Add a customer email before sending a refund receipt.",
    );
  }

  const paidCents =
    current.invoice.paidAmountCents ?? current.invoice.amountCents ?? current.totalCents;
  const alreadyRefundedCents = reservedRefundedCents(current.refunds);
  const refundableCents = Math.max(0, paidCents - alreadyRefundedCents);
  if (parsed.data.amountCents > refundableCents) {
    return problem(
      422,
      "REFUND_AMOUNT_TOO_HIGH",
      `This order has ${(refundableCents / 100).toFixed(2)} ${current.currency} left to refund.`,
    );
  }

  const isStripeRefund = parsed.data.provider === "stripe";
  const localRefundId = newId();
  let providerWarning: string | null = null;
  let result: Awaited<ReturnType<typeof recordOrderRefundAdmin>> = null;

  if (isStripeRefund) {
    if (
      current.invoice.onlinePaymentProvider !== "stripe" ||
      !current.invoice.onlinePaymentIntentId
    ) {
      return problem(
        409,
        "STRIPE_REFUND_NOT_AVAILABLE",
        "This invoice does not have a Stripe payment to refund.",
      );
    }

    try {
      const provider = await getPaymentProvider();
      const stripeRefund = await provider.createRefund({
        refundId: localRefundId,
        orderId: current.id,
        invoiceId: current.invoice.id,
        paymentIntentId: current.invoice.onlinePaymentIntentId,
        amountCents: parsed.data.amountCents,
        currency: current.currency,
        reason: parsed.data.reason,
        note: parsed.data.note,
      });

      result = await recordOrderRefundAdmin(id, {
        id: localRefundId,
        actorId: a.session.user.id,
        amountCents: stripeRefund.amountCents,
        status: stripeRefund.status,
        provider: "stripe",
        providerRefundId: stripeRefund.id,
        providerError: stripeRefund.failureReason,
        method: "Stripe",
        reference: stripeRefund.id,
        reason: parsed.data.reason,
        note: parsed.data.note,
        refundedAt: refundedAt ?? stripeRefund.createdAt,
        sendEmail: canEmailRefund(stripeRefund.status, parsed.data.sendEmail),
      });
    } catch (err) {
      if (
        err instanceof PaymentProviderError &&
        err.code === "PAYMENT_PROVIDER_NOT_CONFIGURED"
      ) {
        return problem(503, err.code, err.message);
      }
      providerWarning =
        err instanceof Error ? err.message : "Stripe could not create the refund.";
      result = await recordOrderRefundAdmin(id, {
        id: localRefundId,
        actorId: a.session.user.id,
        amountCents: parsed.data.amountCents,
        status: "failed",
        provider: "stripe",
        providerError: providerWarning,
        method: "Stripe",
        reason: parsed.data.reason,
        note: parsed.data.note,
        refundedAt,
        sendEmail: false,
      });
    }
  } else {
    result = await recordOrderRefundAdmin(id, {
      id: localRefundId,
      actorId: a.session.user.id,
      amountCents: parsed.data.amountCents,
      status: parsed.data.status,
      provider: "manual",
      providerRefundId: parsed.data.providerRefundId,
      method: parsed.data.method,
      reference: parsed.data.reference,
      reason: parsed.data.reason,
      note: parsed.data.note,
      refundedAt,
      sendEmail: parsed.data.sendEmail,
    });
  }
  if (!result) return notFound();

  let receiptUrl: string | null = null;
  const shouldEmail = canEmailRefund(result.refund.status, parsed.data.sendEmail);
  if (shouldEmail && result.invoiceToken && result.order.email) {
    receiptUrl = `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(
      result.invoiceToken,
    )}`;
    const settings = await getSiteSettings();
    await enqueueEmail(
      storeRefundIssued({
        to: result.order.email,
        order: result.order,
        refund: result.refund,
        receiptUrl,
        statusUrl: orderStatusUrl(issueOrderStatusToken(result.order.id)),
        siteName: settings.siteTitle,
      }),
    );
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: shouldEmail
      ? "order.refund.email"
      : isStripeRefund
        ? result.refund.status === "failed"
          ? "order.refund.stripe_failed"
          : "order.refund.stripe"
        : "order.refund.record",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: {
      invoiceId: current.invoice.id,
      invoiceNumber: current.invoice.number,
      refundId: result.refund.id,
      amountCents: result.refund.amountCents,
      status: result.refund.status,
      provider: result.refund.provider,
      providerRefundId: result.refund.providerRefundId,
      providerError: result.refund.providerError,
      reference: result.refund.reference,
      emailSent: shouldEmail,
    },
  });

  return ok({
    data: {
      order: result.order,
      refund: result.refund,
      receiptUrl,
      warning: providerWarning,
    },
  });
}
