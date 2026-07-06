import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PackingSlipActions } from "@/components/admin/packing-slip-actions";
import { getSession } from "@/src/auth/session";
import { getOrderAdmin } from "@/src/db/queries/orders";
import { selectedOptionsLabel } from "@/src/lib/store-options";

export const dynamic = "force-dynamic";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function itemTitle(description: string | null) {
  if (!description) return "Product";
  return description.split(" — ")[0] || description;
}

export default async function PackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const order = await getOrderAdmin(id);
  if (!order) notFound();

  const packedByItemId = new Map(
    order.packingChecklist.map((entry) => [entry.itemId, entry]),
  );
  const packedCount = order.items.filter(
    (item) => packedByItemId.get(item.id)?.checked,
  ).length;

  return (
    <main className="mx-auto min-h-dvh max-w-4xl bg-white px-6 py-8 text-neutral-950 print:min-h-0 print:max-w-none print:px-0 print:py-0">
      <PackingSlipActions backHref="/admin/store" />
      <section className="rounded-xl border border-neutral-200 p-6 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Packing slip
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {order.clientName || order.email || "Unknown customer"}
            </h1>
            <p className="mt-1 font-mono text-xs text-neutral-500">{order.id}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold capitalize">{order.fulfillmentStatus}</p>
            <p className="text-neutral-500">Received {formatDate(order.createdAt)}</p>
            <p className="text-neutral-500">
              {packedCount}/{order.items.length} packed
            </p>
          </div>
        </header>

        <div className="grid gap-4 border-b border-neutral-200 py-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Contact
            </p>
            <p>{order.email || "No email saved"}</p>
            <p>{order.clientPhone || "No phone saved"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Method
            </p>
            <p>{order.shippingProfileLabel || order.fulfillmentCarrier || "Not set"}</p>
            <p>{order.fulfillmentCarrier || "No carrier saved"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tracking
            </p>
            <p>{order.fulfillmentTrackingNumber || "No tracking number"}</p>
            {order.fulfillmentTrackingUrl && (
              <Link
                href={order.fulfillmentTrackingUrl}
                className="break-all text-neutral-500 underline"
              >
                {order.fulfillmentTrackingUrl}
              </Link>
            )}
          </div>
        </div>

        <section className="py-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Items
          </h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 print:rounded-none">
            <table className="w-full text-sm">
              <thead className="bg-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="w-16 px-3 py-2 font-semibold">Packed</th>
                  <th className="px-3 py-2 font-semibold">Item</th>
                  <th className="px-3 py-2 text-right font-semibold">Qty</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => {
                  const packed = packedByItemId.get(item.id);
                  const optionLabel = selectedOptionsLabel(item.options);
                  return (
                    <tr key={item.id} className="border-t border-neutral-200">
                      <td className="px-3 py-3 align-top">
                        <span className="inline-flex h-5 w-5 items-center justify-center border border-neutral-500 text-xs">
                          {packed?.checked ? "X" : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{itemTitle(item.description)}</p>
                        {optionLabel && (
                          <p className="mt-1 text-xs text-neutral-500">
                            {optionLabel}
                          </p>
                        )}
                        {packed?.checkedAt && (
                          <p className="mt-1 text-xs text-neutral-500">
                            Packed {formatDate(packed.checkedAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        {formatMoney(item.lineTotalCents, order.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 border-t border-neutral-200 pt-5 text-sm sm:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Notes
            </h2>
            <p className="mt-2 whitespace-pre-wrap">
              {order.fulfillmentNotes || order.clientNotes || "No packing notes."}
            </p>
          </div>
          <div className="sm:text-right">
            <p>Subtotal {formatMoney(order.subtotalCents, order.currency)}</p>
            {order.discountCents > 0 && (
              <p>Discount -{formatMoney(order.discountCents, order.currency)}</p>
            )}
            <p>Tax {formatMoney(order.taxCents, order.currency)}</p>
            <p>Shipping {formatMoney(order.shippingCents, order.currency)}</p>
            <p className="mt-2 text-lg font-semibold">
              Total {formatMoney(order.totalCents, order.currency)}
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
