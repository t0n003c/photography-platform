import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, FileText } from "lucide-react";
import { InvoicePrintActions } from "@/components/invoice/invoice-print-actions";
import { getPublicInvoiceByToken } from "@/src/db/queries/orders";
import type { AdminOrderDTO } from "@/src/db/queries/orders";
import {
  getSiteSettings,
  getSiteSettingsRow,
  getStoreCheckoutSettings,
} from "@/src/db/queries/settings";

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

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [data, settings, settingsRow, checkoutSettings] = await Promise.all([
    getPublicInvoiceByToken(token),
    getSiteSettings(),
    getSiteSettingsRow(),
    getStoreCheckoutSettings(),
  ]);
  if (!data) notFound();

  const { invoice, order } = data;
  const isPaid = invoice.status === "paid";
  const statusLabel = isPaid ? "Payment received" : "Payment due";
  const paidAmount = invoice.paidAmountCents ?? invoice.amountCents;
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

        <InvoicePrintActions label={printLabel} />

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
