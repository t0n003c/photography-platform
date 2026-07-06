import { requireRole } from "@/src/auth/session";
import { listOrdersTaxExportAdmin } from "@/src/db/queries/orders";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "order_id",
  "created_at",
  "order_status",
  "customer_name",
  "customer_email",
  "invoice_number",
  "invoice_status",
  "online_payment_provider",
  "online_payment_status",
  "stripe_session_id",
  "stripe_payment_intent_id",
  "paid_at",
  "currency",
  "subtotal_cents",
  "tax_cents",
  "shipping_cents",
  "total_cents",
  "invoice_amount_cents",
  "paid_amount_cents",
  "succeeded_refund_cents",
  "pending_refund_cents",
  "net_paid_cents",
  "item_count",
  "item_descriptions",
  "item_tax_codes",
] as const;

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: readonly unknown[]) {
  return values.map(csvCell).join(",");
}

export async function GET(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 5000);
  const rows = await listOrdersTaxExportAdmin(limit);
  const body = [
    csvRow(COLUMNS),
    ...rows.map((row) =>
      csvRow([
        row.orderId,
        row.createdAt,
        row.orderStatus,
        row.customerName,
        row.customerEmail,
        row.invoiceNumber,
        row.invoiceStatus,
        row.onlinePaymentProvider,
        row.onlinePaymentStatus,
        row.onlinePaymentSessionId,
        row.onlinePaymentIntentId,
        row.paidAt,
        row.currency,
        row.subtotalCents,
        row.taxCents,
        row.shippingCents,
        row.totalCents,
        row.invoiceAmountCents,
        row.paidAmountCents,
        row.succeededRefundCents,
        row.pendingRefundCents,
        row.netPaidCents,
        row.itemCount,
        row.itemDescriptions,
        row.itemTaxCodes,
      ]),
    ),
  ].join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(`${body}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="store-tax-export-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
