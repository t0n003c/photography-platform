import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { issueInvoiceToken } from "@/src/auth/invoice-token";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import {
  getOrderAdmin,
  type AdminInvoiceDTO,
  type AdminOrderDTO,
  type AdminOrderRefundDTO,
  type OrderStatus,
  type RefundStatus,
} from "@/src/db/queries/orders";
import { getSiteSettings } from "@/src/db/queries/settings";
import {
  storeInvoiceIssued,
  storeOrderDelivered,
  storeOrderReady,
  storeOrderShipped,
  storeReceiptIssued,
  storeRefundIssued,
} from "@/src/email/templates";
import { getEnv } from "@/src/lib/env";
import { notFound, ok, parseJson, problem } from "@/src/lib/http";
import { orderStatusUrl } from "@/src/lib/order-status";

export const dynamic = "force-dynamic";

const PreviewSchema = z.object({
  kind: z.enum(["invoice", "receipt", "refund", "fulfillment"]),
  invoice: z
    .object({
      dueAt: z.string().max(40).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      paymentInstructions: z.string().max(2000).nullable().optional(),
    })
    .optional(),
  payment: z
    .object({
      paidAt: z.string().max(40).nullable().optional(),
      paidAmountCents: z.number().int().positive().nullable().optional(),
      paymentMethod: z.string().max(80).nullable().optional(),
      paymentReference: z.string().max(200).nullable().optional(),
      paymentNote: z.string().max(1000).nullable().optional(),
    })
    .optional(),
  refund: z
    .object({
      amountCents: z.number().int().positive(),
      status: z
        .enum(["pending", "succeeded", "failed", "cancelled"])
        .default("succeeded"),
      provider: z.enum(["manual", "stripe"]).default("manual"),
      method: z.string().max(80).nullable().optional(),
      reference: z.string().max(200).nullable().optional(),
      reason: z.string().max(240).nullable().optional(),
      note: z.string().max(1000).nullable().optional(),
      refundedAt: z.string().max(40).nullable().optional(),
    })
    .optional(),
  fulfillment: z
    .object({
      fulfillmentStatus: z.enum([
        "unfulfilled",
        "in_progress",
        "ready",
        "shipped",
        "delivered",
        "cancelled",
      ]),
      fulfillmentCarrier: z.string().max(120).nullable().optional(),
      fulfillmentTrackingNumber: z.string().max(200).nullable().optional(),
      fulfillmentTrackingUrl: z.string().url().max(500).nullable().optional(),
      fulfillmentReadyAt: z.string().max(40).nullable().optional(),
      fulfillmentShippedAt: z.string().max(40).nullable().optional(),
      fulfillmentDeliveredAt: z.string().max(40).nullable().optional(),
      fulfillmentNotes: z.string().max(2000).nullable().optional(),
    })
    .optional(),
});

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function parsePreviewDate(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const raw = value.trim();
  const parsed = new Date(raw.includes("T") ? raw : `${raw}T12:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function previewInvoiceUrl(order: AdminOrderDTO, invoice: AdminInvoiceDTO) {
  const token =
    invoice.id === "preview-invoice"
      ? `preview-${encodeURIComponent(order.id)}`
      : encodeURIComponent(issueInvoiceToken(invoice.id));
  return `${trimSlash(getEnv().APP_BASE_URL)}/invoice/${token}`;
}

function draftInvoice(
  order: AdminOrderDTO,
  opts: {
    kind: "invoice" | "receipt" | "refund";
    invoice?: z.infer<typeof PreviewSchema>["invoice"];
    payment?: z.infer<typeof PreviewSchema>["payment"];
  },
): AdminInvoiceDTO {
  const current = order.invoice;
  const now = new Date().toISOString();
  const paidAt = parsePreviewDate(opts.payment?.paidAt);
  return {
    id: current?.id ?? "preview-invoice",
    number: current?.number ?? "Draft invoice",
    status:
      opts.kind === "receipt" || current?.status === "paid"
        ? "paid"
        : opts.kind === "invoice"
          ? "issued"
          : (current?.status ?? "issued"),
    amountCents: order.totalCents,
    currency: order.currency,
    notes:
      opts.invoice?.notes !== undefined
        ? cleanText(opts.invoice.notes)
        : (current?.notes ?? null),
    paymentInstructions:
      opts.invoice?.paymentInstructions !== undefined
        ? cleanText(opts.invoice.paymentInstructions)
        : (current?.paymentInstructions ?? null),
    issuedAt: current?.issuedAt ?? now,
    sentAt: current?.sentAt ?? (opts.kind === "invoice" ? now : null),
    dueAt:
      opts.invoice?.dueAt !== undefined
        ? parsePreviewDate(opts.invoice.dueAt)
        : (current?.dueAt ?? null),
    paidAt: paidAt ?? current?.paidAt ?? (opts.kind === "receipt" ? now : null),
    paidAmountCents:
      opts.payment?.paidAmountCents && opts.payment.paidAmountCents > 0
        ? opts.payment.paidAmountCents
        : (current?.paidAmountCents ?? order.totalCents),
    paymentMethod:
      opts.payment?.paymentMethod !== undefined
        ? cleanText(opts.payment.paymentMethod)
        : (current?.paymentMethod ?? null),
    paymentReference:
      opts.payment?.paymentReference !== undefined
        ? cleanText(opts.payment.paymentReference)
        : (current?.paymentReference ?? null),
    paymentNote:
      opts.payment?.paymentNote !== undefined
        ? cleanText(opts.payment.paymentNote)
        : (current?.paymentNote ?? null),
    receiptSentAt: current?.receiptSentAt ?? (opts.kind === "receipt" ? now : null),
    onlinePaymentProvider: current?.onlinePaymentProvider ?? null,
    onlinePaymentTaxMode: current?.onlinePaymentTaxMode ?? "fixed",
    onlinePaymentStatus: current?.onlinePaymentStatus ?? null,
    onlinePaymentSessionId: current?.onlinePaymentSessionId ?? null,
    onlinePaymentIntentId: current?.onlinePaymentIntentId ?? null,
    onlinePaymentUrl: current?.onlinePaymentUrl ?? null,
    onlinePaymentExpiresAt: current?.onlinePaymentExpiresAt ?? null,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };
}

function reservedRefundedCents(
  refunds: Array<{ amountCents: number; status: RefundStatus }>,
) {
  return refunds
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
}

function draftRefund(
  order: AdminOrderDTO,
  invoice: AdminInvoiceDTO,
  input: NonNullable<z.infer<typeof PreviewSchema>["refund"]>,
): AdminOrderRefundDTO {
  const now = new Date().toISOString();
  return {
    id: "preview-refund",
    orderId: order.id,
    invoiceId: invoice.id,
    amountCents: input.amountCents,
    currency: invoice.currency,
    status: input.status,
    provider: input.provider,
    providerRefundId: null,
    providerError: null,
    method: input.provider === "stripe" ? "Stripe" : cleanText(input.method),
    reference: input.provider === "stripe" ? null : cleanText(input.reference),
    reason: cleanText(input.reason),
    note: cleanText(input.note),
    refundedAt: parsePreviewDate(input.refundedAt) ?? now,
    receiptSentAt: now,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

function orderWithFulfillment(
  order: AdminOrderDTO,
  input: NonNullable<z.infer<typeof PreviewSchema>["fulfillment"]>,
): AdminOrderDTO {
  const now = new Date().toISOString();
  const readyAt =
    parsePreviewDate(input.fulfillmentReadyAt) ??
    order.fulfillmentReadyAt ??
    (input.fulfillmentStatus === "ready" ||
    input.fulfillmentStatus === "shipped" ||
    input.fulfillmentStatus === "delivered"
      ? now
      : null);
  const shippedAt =
    parsePreviewDate(input.fulfillmentShippedAt) ??
    order.fulfillmentShippedAt ??
    (input.fulfillmentStatus === "shipped" || input.fulfillmentStatus === "delivered"
      ? now
      : null);
  const deliveredAt =
    parsePreviewDate(input.fulfillmentDeliveredAt) ??
    order.fulfillmentDeliveredAt ??
    (input.fulfillmentStatus === "delivered" ? now : null);
  const nextStatus: OrderStatus =
    input.fulfillmentStatus === "delivered"
      ? "fulfilled"
      : order.status === "fulfilled"
        ? "paid"
        : order.status;

  return {
    ...order,
    status: nextStatus,
    fulfillmentStatus: input.fulfillmentStatus,
    fulfillmentCarrier: cleanText(input.fulfillmentCarrier),
    fulfillmentTrackingNumber: cleanText(input.fulfillmentTrackingNumber),
    fulfillmentTrackingUrl: cleanText(input.fulfillmentTrackingUrl),
    fulfillmentReadyAt: readyAt,
    fulfillmentShippedAt: shippedAt,
    fulfillmentDeliveredAt: deliveredAt,
    fulfillmentNotes: cleanText(input.fulfillmentNotes),
    updatedAt: now,
  };
}

function previewRecipient(order: AdminOrderDTO) {
  return order.email ?? "customer@example.com";
}

function emailLabel(kind: z.infer<typeof PreviewSchema>["kind"]) {
  if (kind === "invoice") return "Invoice email";
  if (kind === "receipt") return "Receipt email";
  if (kind === "refund") return "Refund email";
  return "Fulfillment email";
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getOrderAdmin(id);
  if (!current) return notFound();

  const parsed = await parseJson(req, PreviewSchema);
  if ("error" in parsed) return parsed.error;

  const settings = await getSiteSettings();
  const to = previewRecipient(current);
  const statusUrl = orderStatusUrl(issueOrderStatusToken(current.id));
  const base = {
    to,
    order: current,
    siteName: settings.siteTitle,
    statusUrl,
  };

  const message =
    parsed.data.kind === "invoice"
      ? (() => {
          const invoice = draftInvoice(current, {
            kind: "invoice",
            invoice: parsed.data.invoice,
          });
          return storeInvoiceIssued({
            ...base,
            invoice,
            invoiceUrl: previewInvoiceUrl(current, invoice),
          });
        })()
      : parsed.data.kind === "receipt"
        ? (() => {
            const invoice = draftInvoice(current, {
              kind: "receipt",
              payment: parsed.data.payment,
            });
            return storeReceiptIssued({
              ...base,
              order: { ...current, status: "paid", invoice },
              invoice,
              receiptUrl: previewInvoiceUrl(current, invoice),
            });
          })()
        : parsed.data.kind === "refund"
          ? (() => {
              if (!current.invoice || current.invoice.status !== "paid") {
                return problem(
                  409,
                  "INVOICE_NOT_PAID",
                  "Record payment before previewing a refund receipt.",
                );
              }
              if (!parsed.data.refund) {
                return problem(
                  422,
                  "REFUND_PREVIEW_REQUIRED",
                  "Refund preview details are required.",
                );
              }
              const paidCents =
                current.invoice.paidAmountCents ??
                current.invoice.amountCents ??
                current.totalCents;
              const refundableCents = Math.max(
                0,
                paidCents - reservedRefundedCents(current.refunds),
              );
              if (parsed.data.refund.amountCents > refundableCents) {
                return problem(
                  422,
                  "REFUND_AMOUNT_TOO_HIGH",
                  `This order has ${(refundableCents / 100).toFixed(2)} ${current.currency} left to refund.`,
                );
              }
              const refund = draftRefund(current, current.invoice, parsed.data.refund);
              return storeRefundIssued({
                ...base,
                refund,
                receiptUrl: previewInvoiceUrl(current, current.invoice),
              });
            })()
          : (() => {
              if (!parsed.data.fulfillment) {
                return problem(
                  422,
                  "FULFILLMENT_PREVIEW_REQUIRED",
                  "Fulfillment preview details are required.",
                );
              }
              const status = parsed.data.fulfillment.fulfillmentStatus;
              if (
                status !== "ready" &&
                status !== "shipped" &&
                status !== "delivered"
              ) {
                return problem(
                  422,
                  "FULFILLMENT_EMAIL_NOT_AVAILABLE",
                  "Fulfillment emails are available for ready, shipped, or delivered updates.",
                );
              }
              const order = orderWithFulfillment(current, parsed.data.fulfillment);
              const receiptUrl = order.invoice
                ? previewInvoiceUrl(order, order.invoice)
                : null;
              const opts = { ...base, order, receiptUrl };
              return status === "delivered"
                ? storeOrderDelivered(opts)
                : status === "shipped"
                  ? storeOrderShipped(opts)
                  : storeOrderReady(opts);
            })();

  if (message instanceof Response) return message;

  return ok({
    data: {
      kind: parsed.data.kind,
      label: emailLabel(parsed.data.kind),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text ?? "",
      note: current.email
        ? null
        : "Preview uses a placeholder recipient because this order has no customer email yet.",
    },
  });
}
