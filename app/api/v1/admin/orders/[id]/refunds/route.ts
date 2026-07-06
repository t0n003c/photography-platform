import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { enqueueEmail } from "@/src/email/send";
import { storeRefundIssued } from "@/src/email/templates";
import { getSiteSettings } from "@/src/db/queries/settings";
import {
  getOrderAdmin,
  recordOrderRefundAdmin,
  type RefundStatus,
} from "@/src/db/queries/orders";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const RefundSchema = z.object({
  amountCents: z.number().int().positive(),
  status: z
    .enum(["pending", "succeeded", "failed", "cancelled"])
    .default("succeeded"),
  provider: z.string().max(80).nullable().optional(),
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

function successfulRefundedCents(
  refunds: Array<{ amountCents: number; status: RefundStatus }>,
) {
  return refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
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
  if (parsed.data.sendEmail && parsed.data.status !== "succeeded") {
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
  const alreadyRefundedCents = successfulRefundedCents(current.refunds);
  const refundableCents = Math.max(0, paidCents - alreadyRefundedCents);
  if (parsed.data.amountCents > refundableCents) {
    return problem(
      422,
      "REFUND_AMOUNT_TOO_HIGH",
      `This order has ${(refundableCents / 100).toFixed(2)} ${current.currency} left to refund.`,
    );
  }

  const result = await recordOrderRefundAdmin(id, {
    actorId: a.session.user.id,
    amountCents: parsed.data.amountCents,
    status: parsed.data.status,
    provider: parsed.data.provider,
    providerRefundId: parsed.data.providerRefundId,
    method: parsed.data.method,
    reference: parsed.data.reference,
    reason: parsed.data.reason,
    note: parsed.data.note,
    refundedAt,
    sendEmail: parsed.data.sendEmail,
  });
  if (!result) return notFound();

  let receiptUrl: string | null = null;
  if (parsed.data.sendEmail && result.invoiceToken && result.order.email) {
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
        siteName: settings.siteTitle,
      }),
    );
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: parsed.data.sendEmail ? "order.refund.email" : "order.refund.record",
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
      reference: result.refund.reference,
      emailSent: parsed.data.sendEmail,
    },
  });

  return ok({ data: { order: result.order, refund: result.refund, receiptUrl } });
}
