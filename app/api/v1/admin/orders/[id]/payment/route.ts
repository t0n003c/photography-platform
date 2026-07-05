import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { enqueueEmail } from "@/src/email/send";
import { storeReceiptIssued } from "@/src/email/templates";
import { getSiteSettings } from "@/src/db/queries/settings";
import {
  getOrderAdmin,
  recordInvoicePaymentAdmin,
} from "@/src/db/queries/orders";

export const dynamic = "force-dynamic";

const PaymentSchema = z.object({
  paidAt: z.string().max(40).nullable().optional(),
  paidAmountCents: z.number().int().positive().nullable().optional(),
  paymentMethod: z.string().max(80).nullable().optional(),
  paymentReference: z.string().max(200).nullable().optional(),
  paymentNote: z.string().max(1000).nullable().optional(),
  sendReceipt: z.boolean().default(false),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function parsePaidDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

  const parsed = await parseJson(req, PaymentSchema);
  if ("error" in parsed) return parsed.error;
  const paidAt = parsePaidDate(parsed.data.paidAt);
  if (parsed.data.paidAt?.trim() && !paidAt) {
    return problem(422, "INVALID_PAID_DATE", "Payment date is invalid.");
  }
  if (parsed.data.sendReceipt && !current.email) {
    return problem(
      422,
      "ORDER_EMAIL_REQUIRED",
      "Add a customer email before sending a receipt.",
    );
  }

  const result = await recordInvoicePaymentAdmin(id, {
    paidAt,
    paidAmountCents: parsed.data.paidAmountCents,
    paymentMethod: parsed.data.paymentMethod,
    paymentReference: parsed.data.paymentReference,
    paymentNote: parsed.data.paymentNote,
    sendReceipt: parsed.data.sendReceipt,
  });
  if (!result) return notFound();

  let receiptUrl: string | null = null;
  const invoice = result.order.invoice;
  if (parsed.data.sendReceipt && result.invoiceToken && invoice && result.order.email) {
    receiptUrl = `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${encodeURIComponent(
      result.invoiceToken,
    )}`;
    const settings = await getSiteSettings();
    await enqueueEmail(
      storeReceiptIssued({
        to: result.order.email,
        order: result.order,
        invoice,
        receiptUrl,
        siteName: settings.siteTitle,
      }),
    );
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: parsed.data.sendReceipt ? "order.payment.receipt" : "order.payment.record",
    entityType: "order",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: {
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.number ?? null,
      fromStatus: current.status,
      toStatus: result.order.status,
      receiptSent: parsed.data.sendReceipt,
      paidAmountCents: invoice?.paidAmountCents ?? null,
      paymentMethod: invoice?.paymentMethod ?? null,
    },
  });

  return ok({ data: { order: result.order, receiptUrl } });
}
