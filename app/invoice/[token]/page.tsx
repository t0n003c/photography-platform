import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, FileText } from "lucide-react";
import { InvoicePrintActions } from "@/components/invoice/invoice-print-actions";
import { StripePaymentButton } from "@/components/invoice/stripe-payment-button";
import { getPublicInvoiceByToken } from "@/src/db/queries/orders";
import type { AdminOrderDTO } from "@/src/db/queries/orders";
import {
  getSiteSettings,
  getSiteSettingsRow,
  getStoreCheckoutSettings,
  getStorePaymentSettings,
} from "@/src/db/queries/settings";
import { storePaymentStatus } from "@/src/lib/store-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function shippingText(order: AdminOrderDTO) {
  if (order.shippingCents > 0) return formatMoney(order.shippingCents, order.currency);
  if (order.storeSettingsSnapshot.shippingMode === "free") return "Free";
  if (order.storeSettingsSnapshot.shippingMode === "manual") return "Quoted";
  return formatMoney(0, order.currency);
}

function invoiceItemTitle(item: AdminOrderDTO["items"][number]) {
  if (!item.description) return "Product";
  return item.description.split(" — ")[0] || item.description;
}

function fulfillmentLabel(status: AdminOrderDTO["fulfillmentStatus"]) {
  return status.replace(/_/g, " ");
}

export default async function PublicInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ payment?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [data, settings, settingsRow, checkoutSettings, paymentSettings] =
    await Promise.all([
      getPublicInvoiceByToken(token),
      getSiteSettings(),
      getSiteSettingsRow(),
      getStoreCheckoutSettings(),
      getStorePaymentSettings(),
    ]);
  if (!data) notFound();

  const { invoice, order } = data;
  const isPaid = invoice.status === "paid";
  const paymentQuery = query?.payment;
  const paymentStatus = storePaymentStatus(paymentSettings);
  const hostedPaymentExpired = invoice.onlinePaymentStatus === "expired";
  const canPayOnline =
    !isPaid &&
    invoice.status === "issued" &&
    paymentStatus.readyForHostedCheckout &&
    invoice.amountCents > 0;
  const paymentNotice =
    paymentQuery === "success" && isPaid
      ? {
          tone: "green",
          title: "Payment received",
          body: "Thank you. This invoice is now marked paid.",
        }
      : paymentQuery === "success"
        ? {
            tone: "blue",
            title: "Payment is being confirmed",
            body: "Stripe sent you back successfully. If the status still says payment due, refresh in a moment while the webhook finishes.",
          }
        : paymentQuery === "cancelled"
          ? {
              tone: "amber",
              title: "Checkout was cancelled",
              body: canPayOnline
                ? "No payment was recorded. You can start a fresh secure checkout when you are ready."
                : "No payment was recorded. Contact the studio if you need a new secure checkout link.",
            }
          : hostedPaymentExpired
            ? {
                tone: "amber",
                title: "Previous payment link expired",
                body: canPayOnline
                  ? "Use Pay online to generate a fresh secure checkout link."
                  : "Contact the studio if you need a new secure checkout link.",
              }
            : null;
  const statusLabel = isPaid ? "Payment received" : "Payment due";
  const paidAmount = invoice.paidAmountCents ?? invoice.amountCents;
  const successfulRefunds = order.refunds.filter(
    (refund) => refund.status === "succeeded",
  );
  const pendingRefunds = order.refunds.filter((refund) => refund.status === "pending");
  const visibleRefunds = order.refunds.filter(
    (refund) => refund.status === "succeeded" || refund.status === "pending",
  );
  const refundedAmount = successfulRefunds.reduce(
    (sum, refund) => sum + refund.amountCents,
    0,
  );
  const pendingRefundAmount = pendingRefunds.reduce(
    (sum, refund) => sum + refund.amountCents,
    0,
  );
  const netPaidAmount = Math.max(0, paidAmount - refundedAmount);
  const hasFulfillmentDetails =
    order.fulfillmentStatus !== "unfulfilled" ||
    Boolean(order.fulfillmentCarrier) ||
    Boolean(order.fulfillmentTrackingNumber) ||
    Boolean(order.fulfillmentTrackingUrl) ||
    Boolean(order.fulfillmentReadyAt) ||
    Boolean(order.fulfillmentShippedAt) ||
    Boolean(order.fulfillmentDeliveredAt);
  const contactEmail =
    settingsRow?.storeNotifyEmail?.trim() ||
    settingsRow?.emailFrom?.trim() ||
    null;
  const printLabel = `${isPaid ? "Receipt" : "Invoice"} ${invoice.number}`;

  return (
    <main className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))] print:bg-white print:text-black">
      <style>{`
        @media print {
          @page { margin: 0.55in; }
          html, body { background: #fff !important; }
        }
      `}</style>
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12 print:max-w-none print:gap-4 print:px-0 print:py-0">
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link
            href="/"
            className="text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]"
          >
            {settings.siteTitle}
          </Link>
          <span className="rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
            {isPaid ? "Secure receipt" : "Secure invoice"}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <InvoicePrintActions label={printLabel} />
          {canPayOnline && (
            <StripePaymentButton
              token={token}
              label={hostedPaymentExpired ? "Get fresh payment link" : "Pay online"}
            />
          )}
        </div>

        {paymentNotice && (
          <div
            className={[
              "rounded-xl border px-4 py-3 text-sm print:hidden",
              paymentNotice.tone === "green"
                ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-950/35 dark:text-green-200"
                : paymentNotice.tone === "blue"
                  ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200"
                  : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200",
            ].join(" ")}
          >
            <p className="font-semibold">{paymentNotice.title}</p>
            <p className="mt-1">{paymentNotice.body}</p>
          </div>
        )}

        <div className="rounded-2xl border bg-[hsl(var(--card))] p-5 shadow-sm sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
          <div className="mb-6 hidden items-start justify-between gap-6 border-b pb-5 print:flex">
            <div>
              {settings.logoStorageKey ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/api/v1/media/site-logo"
                  alt={settings.siteTitle}
                  className="mb-3 h-10 w-auto"
                />
              ) : (
                <p className="text-lg font-semibold">{settings.siteTitle}</p>
              )}
              {settings.tagline && (
                <p className="mt-1 text-sm text-neutral-600">{settings.tagline}</p>
              )}
            </div>
            <div className="text-right text-xs text-neutral-600">
              <p className="font-semibold uppercase tracking-[0.18em] text-neutral-900">
                {isPaid ? "Receipt" : "Invoice"}
              </p>
              <p>{invoice.number}</p>
            </div>
          </div>

          <div className="flex flex-col gap-6 border-b pb-6 md:flex-row md:items-start md:justify-between print:break-inside-avoid print:gap-5 print:pb-5">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
                {isPaid ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden />
                ) : (
                  <FileText className="h-6 w-6" aria-hidden />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[hsl(var(--muted-foreground))]">
                  {statusLabel}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-5xl">
                  {invoice.number}
                </h1>
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  Order {order.id}
                </p>
              </div>
            </div>

            <div className="grid min-w-[14rem] gap-3 rounded-xl bg-[hsl(var(--muted))] p-4 text-sm print:bg-neutral-100">
              <div className="flex justify-between gap-4">
                <span className="text-[hsl(var(--muted-foreground))]">Issued</span>
                <strong>{formatDate(invoice.issuedAt)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[hsl(var(--muted-foreground))]">Due</span>
                <strong>{formatDate(invoice.dueAt)}</strong>
              </div>
              {isPaid && (
                <div className="flex justify-between gap-4">
                  <span className="text-[hsl(var(--muted-foreground))]">Paid</span>
                  <strong>{formatDate(invoice.paidAt)}</strong>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-[hsl(var(--muted-foreground))]">Status</span>
                <strong className="capitalize">{invoice.status}</strong>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b py-6 text-sm sm:grid-cols-2 print:break-inside-avoid print:py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                Bill to
              </p>
              <p className="mt-2 font-medium">
                {order.clientName || order.email || "Client"}
              </p>
              {order.email && (
                <p className="text-[hsl(var(--muted-foreground))]">{order.email}</p>
              )}
              {order.clientPhone && (
                <p className="text-[hsl(var(--muted-foreground))]">
                  {order.clientPhone}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                From
              </p>
              <p className="mt-2 font-medium">{settings.siteTitle}</p>
              <p className="text-[hsl(var(--muted-foreground))]">
                {checkoutSettings.checkoutLabel}
              </p>
              {contactEmail && (
                <p className="text-[hsl(var(--muted-foreground))]">{contactEmail}</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden border-b py-6 print:break-inside-avoid print:py-5">
            <div className="hidden grid-cols-[1fr_5rem_8rem_8rem] gap-4 border-b pb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))] md:grid">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_5rem_8rem_8rem] md:items-start md:gap-4"
                >
                  <div>
                    <h2 className="font-medium">{invoiceItemTitle(item)}</h2>
                    {item.options.length > 0 && (
                      <ul className="mt-2 grid gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                        {item.options.map((option) => (
                          <li key={`${item.id}-${option.optionId}`}>
                            {option.optionName}: {option.valueLabel}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex justify-between md:block md:text-right">
                    <span className="text-[hsl(var(--muted-foreground))] md:hidden">
                      Qty
                    </span>
                    <span>{item.quantity}</span>
                  </div>
                  <div className="flex justify-between md:block md:text-right">
                    <span className="text-[hsl(var(--muted-foreground))] md:hidden">
                      Unit
                    </span>
                    <span>{formatMoney(item.unitPriceCents, order.currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium md:block md:text-right">
                    <span className="text-[hsl(var(--muted-foreground))] md:hidden">
                      Total
                    </span>
                    <span>{formatMoney(item.lineTotalCents, order.currency)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-6 pt-6 md:grid-cols-[1fr_20rem] print:gap-5 print:pt-5">
            <div className="space-y-4">
              {invoice.notes && (
                <div>
                  <h2 className="text-sm font-semibold">Invoice notes</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {isPaid ? (
                <div>
                  <h2 className="text-sm font-semibold">Payment receipt</h2>
                  <div className="mt-2 grid gap-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <p>Amount paid: {formatMoney(paidAmount, invoice.currency)}</p>
                    {refundedAmount > 0 && (
                      <>
                        <p>
                          Amount refunded:{" "}
                          {formatMoney(refundedAmount, invoice.currency)}
                        </p>
                        <p>Net paid: {formatMoney(netPaidAmount, invoice.currency)}</p>
                      </>
                    )}
                    {pendingRefundAmount > 0 && (
                      <p>
                        Pending refund:{" "}
                        {formatMoney(pendingRefundAmount, invoice.currency)}
                      </p>
                    )}
                    <p>Paid: {formatDate(invoice.paidAt)}</p>
                    {invoice.paymentMethod && <p>Method: {invoice.paymentMethod}</p>}
                    {invoice.paymentReference && (
                      <p>Reference: {invoice.paymentReference}</p>
                    )}
                    {invoice.paymentNote && (
                      <p className="whitespace-pre-wrap">{invoice.paymentNote}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-sm font-semibold">Payment instructions</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[hsl(var(--muted-foreground))]">
                    {invoice.paymentInstructions ||
                      "The studio will follow up with payment instructions."}
                  </p>
                </div>
              )}
              {visibleRefunds.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold">Refunds</h2>
                  <div className="mt-2 grid gap-3 text-sm text-[hsl(var(--muted-foreground))]">
                    {visibleRefunds.map((refund) => (
                      <div
                        key={refund.id}
                        className="rounded-lg bg-[hsl(var(--muted))] p-3 print:bg-neutral-100"
                      >
                        <p className="font-medium text-[hsl(var(--foreground))]">
                          {formatMoney(refund.amountCents, refund.currency)}
                        </p>
                        <div className="mt-1 grid gap-1">
                          <p>
                            {refund.status === "pending"
                              ? "Refund pending"
                              : "Refunded"}
                            :{" "}
                            {refund.refundedAt
                              ? formatDate(refund.refundedAt)
                              : formatDate(refund.createdAt)}
                          </p>
                          {refund.provider === "stripe" && <p>Provider: Stripe</p>}
                          {refund.method && <p>Method: {refund.method}</p>}
                          {refund.reference && <p>Reference: {refund.reference}</p>}
                          {refund.reason && <p>Reason: {refund.reason}</p>}
                          {refund.note && (
                            <p className="whitespace-pre-wrap">{refund.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {hasFulfillmentDetails && (
                <div>
                  <h2 className="text-sm font-semibold">Fulfillment</h2>
                  <div className="mt-2 grid gap-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <p className="capitalize">
                      Status: {fulfillmentLabel(order.fulfillmentStatus)}
                    </p>
                    {order.fulfillmentCarrier && (
                      <p>Carrier: {order.fulfillmentCarrier}</p>
                    )}
                    {order.fulfillmentTrackingNumber && (
                      <p>Tracking: {order.fulfillmentTrackingNumber}</p>
                    )}
                    {order.fulfillmentReadyAt && (
                      <p>Ready: {formatDate(order.fulfillmentReadyAt)}</p>
                    )}
                    {order.fulfillmentShippedAt && (
                      <p>Shipped: {formatDate(order.fulfillmentShippedAt)}</p>
                    )}
                    {order.fulfillmentDeliveredAt && (
                      <p>Delivered: {formatDate(order.fulfillmentDeliveredAt)}</p>
                    )}
                    {order.fulfillmentTrackingUrl && (
                      <p className="print:hidden">
                        <a
                          href={order.fulfillmentTrackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-[hsl(var(--foreground))] underline underline-offset-4"
                        >
                          Track shipment
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-3 rounded-xl bg-[hsl(var(--muted))] p-4 text-sm print:break-inside-avoid print:bg-neutral-100">
              <div className="flex justify-between gap-4">
                <span>Subtotal</span>
                <strong>{formatMoney(order.subtotalCents, order.currency)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Tax</span>
                <strong>{formatMoney(order.taxCents, order.currency)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Shipping</span>
                <strong>{shippingText(order)}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t pt-3 text-lg">
                <span>Total</span>
                <strong>{formatMoney(order.totalCents, order.currency)}</strong>
              </div>
              {isPaid && (
                <div className="flex justify-between gap-4 border-t pt-3">
                  <span>Amount paid</span>
                  <strong>{formatMoney(paidAmount, invoice.currency)}</strong>
                </div>
              )}
              {refundedAmount > 0 && (
                <>
                  <div className="flex justify-between gap-4">
                    <span>Amount refunded</span>
                    <strong>{formatMoney(refundedAmount, invoice.currency)}</strong>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-3">
                    <span>Net paid</span>
                    <strong>{formatMoney(netPaidAmount, invoice.currency)}</strong>
                  </div>
                </>
              )}
              {pendingRefundAmount > 0 && (
                <div className="flex justify-between gap-4">
                  <span>Pending refund</span>
                  <strong>{formatMoney(pendingRefundAmount, invoice.currency)}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 hidden border-t pt-4 text-xs text-neutral-500 print:block">
            <p>
              {isPaid ? "Receipt" : "Invoice"} generated by {settings.siteTitle}.
              {contactEmail ? ` Questions? Contact ${contactEmail}.` : ""}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
