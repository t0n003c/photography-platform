import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  PackageCheck,
  PackageOpen,
  Truck,
} from "lucide-react";
import { InvoicePrintActions } from "@/components/invoice/invoice-print-actions";
import { StripePaymentButton } from "@/components/invoice/stripe-payment-button";
import { getPublicInvoiceByToken } from "@/src/db/queries/orders";
import type { AdminInvoiceDTO, AdminOrderDTO } from "@/src/db/queries/orders";
import { issueOrderStatusToken } from "@/src/auth/order-status-token";
import {
  getSiteSettings,
  getSiteSettingsRow,
  getStoreCheckoutSettings,
  getStorePaymentSettings,
} from "@/src/db/queries/settings";
import { orderStatusUrl } from "@/src/lib/order-status";
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
  if (order.shippingProfileLabel) {
    return order.shippingProfileLabel.toLowerCase().includes("quote")
      ? "Quoted"
      : "Free";
  }
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

function invoiceNextStep(
  order: AdminOrderDTO,
  invoice: AdminInvoiceDTO,
  isPaid: boolean,
) {
  if (order.status === "cancelled" || order.fulfillmentStatus === "cancelled") {
    return {
      title: "Order closed",
      body: "This order is marked cancelled. Contact the studio if you think this is incorrect.",
    };
  }
  if (!isPaid) {
    return {
      title: "Payment due",
      body: invoice.dueAt
        ? `Payment is due ${formatDate(invoice.dueAt)}. Use the payment details on this invoice when you are ready.`
        : "Use the payment details on this invoice when you are ready.",
    };
  }
  if (
    order.fulfillmentStatus === "unfulfilled" ||
    order.fulfillmentStatus === "in_progress"
  ) {
    return {
      title: "Studio prep",
      body: "Payment is recorded. The studio is preparing your order and will update the status page when it is ready or shipped.",
    };
  }
  if (order.fulfillmentStatus === "ready") {
    return {
      title: "Ready for handoff",
      body: "Your order is ready. Watch the status page for pickup, delivery, or shipping details.",
    };
  }
  if (order.fulfillmentStatus === "shipped") {
    return {
      title: "On the way",
      body: order.fulfillmentTrackingNumber
        ? `Your order has shipped with tracking ${order.fulfillmentTrackingNumber}.`
        : "Your order has shipped. Tracking details will appear on the status page when available.",
    };
  }
  return {
    title: "Delivered",
    body: "Your order has been marked delivered. Thank you for ordering from the studio.",
  };
}

function invoiceProgressSteps(
  order: AdminOrderDTO,
  invoice: AdminInvoiceDTO,
  isPaid: boolean,
) {
  const prepStarted =
    isPaid ||
    order.fulfillmentStatus === "in_progress" ||
    order.fulfillmentStatus === "ready" ||
    order.fulfillmentStatus === "shipped" ||
    order.fulfillmentStatus === "delivered";
  const ready = order.fulfillmentStatus === "ready";
  const shipped =
    order.fulfillmentStatus === "shipped" ||
    order.fulfillmentStatus === "delivered";
  const delivered = order.fulfillmentStatus === "delivered";

  return [
    {
      title: "Invoice sent",
      date: invoice.sentAt ?? invoice.issuedAt,
      active: true,
      Icon: FileText,
    },
    {
      title: "Payment received",
      date: invoice.paidAt,
      active: isPaid,
      Icon: CreditCard,
    },
    {
      title: "Studio prep",
      date: order.fulfillmentReadyAt,
      active: prepStarted,
      Icon: PackageOpen,
    },
    {
      title: shipped ? "Shipped" : ready ? "Ready" : "Handoff",
      date: shipped
        ? order.fulfillmentShippedAt
        : ready
          ? order.fulfillmentReadyAt
          : null,
      active: ready || shipped || delivered,
      Icon: Truck,
    },
    {
      title: "Delivered",
      date: order.fulfillmentDeliveredAt,
      active: delivered,
      Icon: PackageCheck,
    },
  ];
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
  const stripeTaxCheckout =
    canPayOnline &&
    invoice.onlinePaymentProvider === "stripe" &&
    invoice.onlinePaymentTaxMode === "stripe";
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
  const statusUrl = orderStatusUrl(issueOrderStatusToken(order.id));
  const nextStep = invoiceNextStep(order, invoice, isPaid);
  const progressSteps = invoiceProgressSteps(order, invoice, isPaid);

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
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={statusUrl}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-sm font-medium transition hover:bg-[hsl(var(--muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              Track order status
            </Link>
            {canPayOnline && (
              <StripePaymentButton
                token={token}
                label={hostedPaymentExpired ? "Get fresh payment link" : "Pay online"}
              />
            )}
          </div>
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

        {stripeTaxCheckout && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200 print:hidden">
            <p className="font-semibold">Tax calculated at checkout</p>
            <p className="mt-1">
              Stripe Tax will confirm tax during secure checkout. Your final paid
              total may update before the receipt is issued.
            </p>
          </div>
        )}

        <div className="flex gap-3 rounded-xl border bg-[hsl(var(--card))] px-4 py-3 text-sm shadow-sm print:hidden">
          <Clock3
            className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--muted-foreground))]"
            aria-hidden
          />
          <div>
            <p className="font-semibold">{nextStep.title}</p>
            <p className="mt-1 text-[hsl(var(--muted-foreground))]">
              {nextStep.body}
            </p>
          </div>
        </div>

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
              {(hasFulfillmentDetails || isPaid || invoice.status === "issued") && (
                <div>
                  <h2 className="text-sm font-semibold">Order progress</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 print:grid-cols-2">
                    {progressSteps.map(({ title, date, active, Icon }) => (
                      <div
                        key={title}
                        className={[
                          "rounded-lg border p-3 text-sm",
                          active
                            ? "border-[hsl(var(--foreground))] bg-[hsl(var(--muted))]"
                            : "text-[hsl(var(--muted-foreground))]",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="font-medium">{title}</span>
                        </div>
                        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                          {formatDate(date)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-1 text-sm text-[hsl(var(--muted-foreground))]">
                    <p>
                      Current fulfillment status:{" "}
                      <span className="capitalize">
                        {fulfillmentLabel(order.fulfillmentStatus)}
                      </span>
                    </p>
                    {(order.fulfillmentCarrier ||
                      order.fulfillmentTrackingNumber ||
                      order.fulfillmentTrackingUrl) && (
                      <div className="mt-1 rounded-lg bg-[hsl(var(--muted))] p-3 print:bg-neutral-100">
                        {order.fulfillmentCarrier && (
                          <p>Carrier: {order.fulfillmentCarrier}</p>
                        )}
                        {order.fulfillmentTrackingNumber && (
                          <p>Tracking: {order.fulfillmentTrackingNumber}</p>
                        )}
                        {order.fulfillmentTrackingUrl && (
                          <p className="mt-2 print:hidden">
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
              {order.discountCents > 0 && (
                <div className="flex justify-between gap-4">
                  <span>
                    Discount{order.promoCode ? ` · ${order.promoCode}` : ""}
                  </span>
                  <strong>-{formatMoney(order.discountCents, order.currency)}</strong>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span>Tax</span>
                <strong>{formatMoney(order.taxCents, order.currency)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>
                  Shipping
                  {order.shippingProfileLabel
                    ? ` · ${order.shippingProfileLabel}`
                    : ""}
                </span>
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
