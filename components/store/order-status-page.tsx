"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  PackageCheck,
  PackageOpen,
  Search,
  Truck,
} from "lucide-react";
import type { SelectedProductOption } from "@/src/lib/store-options";

interface PublicOrderStatusItem {
  id: string;
  description: string | null;
  options: SelectedProductOption[];
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

interface PublicOrderStatusRefund {
  id: string;
  amountCents: number;
  currency: string;
  status: "pending" | "succeeded";
  reason: string | null;
  refundedAt: string | null;
}

interface PublicOrderStatus {
  id: string;
  customerName: string | null;
  maskedEmail: string | null;
  status: "draft" | "pending" | "invoiced" | "paid" | "fulfilled" | "cancelled";
  fulfillmentStatus:
    | "unfulfilled"
    | "in_progress"
    | "ready"
    | "shipped"
    | "delivered"
    | "cancelled";
  fulfillmentCarrier: string | null;
  fulfillmentTrackingNumber: string | null;
  fulfillmentTrackingUrl: string | null;
  fulfillmentReadyAt: string | null;
  fulfillmentShippedAt: string | null;
  fulfillmentDeliveredAt: string | null;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  taxCents: number;
  shippingCents: number;
  shippingProfileLabel: string | null;
  totalCents: number;
  currency: string;
  invoice: {
    number: string;
    status: "draft" | "issued" | "paid" | "void";
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
    paidAmountCents: number | null;
    onlinePaymentStatus:
      | "requires_payment"
      | "pending"
      | "paid"
      | "failed"
      | "expired"
      | "refunded"
      | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  items: PublicOrderStatusItem[];
  refunds: PublicOrderStatusRefund[];
}

interface StatusResponse {
  data: {
    order: PublicOrderStatus;
    statusUrl: string;
  };
}

interface OrderStatusPageProps {
  token: string | null;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

function orderItemTitle(item: PublicOrderStatusItem) {
  if (!item.description) return "Product";
  if (item.options.length === 0) return item.description;
  return item.description.split(" — ")[0] || item.description;
}

function optionLine(option: SelectedProductOption, currency: string) {
  const delta =
    option.priceDeltaCents === 0
      ? ""
      : ` (${option.priceDeltaCents > 0 ? "+" : "-"}${formatMoney(
          Math.abs(option.priceDeltaCents),
          currency,
        )})`;
  return `${option.optionName}: ${option.valueLabel}${delta}`;
}

function isPaid(order: PublicOrderStatus) {
  return (
    order.status === "paid" ||
    order.status === "fulfilled" ||
    order.invoice?.status === "paid"
  );
}

function isCancelled(order: PublicOrderStatus) {
  return order.status === "cancelled" || order.fulfillmentStatus === "cancelled";
}

function shippingText(order: PublicOrderStatus) {
  if (order.shippingCents > 0) return formatMoney(order.shippingCents, order.currency);
  if (order.shippingProfileLabel) {
    return order.shippingProfileLabel.toLowerCase().includes("quote")
      ? "Quoted after review"
      : "Free";
  }
  return formatMoney(0, order.currency);
}

function nextStepCopy(order: PublicOrderStatus) {
  if (isCancelled(order)) {
    return {
      title: "Order closed",
      body: "This order is marked cancelled. Contact the studio if you think this is incorrect.",
    };
  }
  if (!order.invoice) {
    return {
      title: "Studio review",
      body: "Your request is in review. The studio will confirm details and send an invoice when it is ready.",
    };
  }
  if (!isPaid(order)) {
    return {
      title: "Payment due",
      body: order.invoice.dueAt
        ? `Invoice ${order.invoice.number} is due ${formatDate(order.invoice.dueAt)}.`
        : `Invoice ${order.invoice.number} is ready for payment.`,
    };
  }
  if (
    order.fulfillmentStatus === "unfulfilled" ||
    order.fulfillmentStatus === "in_progress"
  ) {
    return {
      title: "Studio prep",
      body: "Payment is recorded. The studio is preparing your order and will update this page when it is ready or shipped.",
    };
  }
  if (order.fulfillmentStatus === "ready") {
    return {
      title: "Ready for handoff",
      body: "Your order is ready. Watch for pickup, delivery, or shipping details from the studio.",
    };
  }
  if (order.fulfillmentStatus === "shipped") {
    return {
      title: "On the way",
      body: order.fulfillmentTrackingNumber
        ? `Your order has shipped with tracking ${order.fulfillmentTrackingNumber}.`
        : "Your order has shipped. Tracking details will appear here when available.",
    };
  }
  return {
    title: "Delivered",
    body: "Your order has been marked delivered. Thank you for ordering from the studio.",
  };
}

function progressSteps(order: PublicOrderStatus) {
  const paid = isPaid(order);
  const cancelled = isCancelled(order);
  const prepStarted =
    paid ||
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
      title: "Request received",
      body: "Your order request is in the studio queue.",
      date: order.createdAt,
      state: "complete",
      Icon: CheckCircle2,
    },
    {
      title: paid ? "Payment received" : order.invoice ? "Invoice sent" : "Invoice pending",
      body: paid
        ? "Payment is recorded."
        : order.invoice
          ? "Invoice is ready for review and payment."
          : "The studio is preparing your invoice.",
      date: paid ? order.invoice?.paidAt : (order.invoice?.issuedAt ?? null),
      state: cancelled
        ? "waiting"
        : paid
          ? "complete"
          : order.invoice
            ? "current"
            : "waiting",
      Icon: CreditCard,
    },
    {
      title: "Studio prep",
      body: prepStarted
        ? "Your order is being prepared."
        : "Preparation begins after payment.",
      date: order.fulfillmentReadyAt,
      state: cancelled
        ? "waiting"
        : ready || shipped || delivered
          ? "complete"
          : prepStarted
            ? "current"
            : "waiting",
      Icon: PackageOpen,
    },
    {
      title: shipped ? "Shipped" : ready ? "Ready" : "Handoff",
      body: shipped
        ? "Your order is on the way."
        : ready
          ? "Your order is ready for pickup or handoff."
          : "Shipping or pickup details will appear here.",
      date: shipped
        ? order.fulfillmentShippedAt
        : ready
          ? order.fulfillmentReadyAt
          : null,
      state: cancelled
        ? "waiting"
        : shipped
          ? "complete"
          : ready
            ? "current"
            : "waiting",
      Icon: Truck,
    },
    {
      title: "Delivered",
      body: delivered
        ? "Delivery is complete."
        : "The final delivery update will appear here.",
      date: order.fulfillmentDeliveredAt,
      state: cancelled ? "waiting" : delivered ? "complete" : "waiting",
      Icon: PackageCheck,
    },
  ];
}

async function readStatus(res: Response): Promise<StatusResponse> {
  const body = await res.json();
  if (!res.ok) {
    const message =
      body?.error?.message ?? "We could not load that order status.";
    throw new Error(message);
  }
  return body as StatusResponse;
}

export function OrderStatusPage({ token }: OrderStatusPageProps) {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrderStatus | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/orders/status?token=${encodeURIComponent(token)}`)
      .then(readStatus)
      .then((body) => {
        if (cancelled) return;
        setOrder(body.data.order);
        setStatusUrl(body.data.statusUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Order status not found.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const timeline = useMemo(() => (order ? progressSteps(order) : []), [order]);
  const nextStep = useMemo(() => (order ? nextStepCopy(order) : null), [order]);
  const refundedCents = useMemo(
    () =>
      order?.refunds
        .filter((refund) => refund.status === "succeeded")
        .reduce((sum, refund) => sum + refund.amountCents, 0) ?? 0,
    [order],
  );
  const pendingRefundCents = useMemo(
    () =>
      order?.refunds
        .filter((refund) => refund.status === "pending")
        .reduce((sum, refund) => sum + refund.amountCents, 0) ?? 0,
    [order],
  );

  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const body = await readStatus(
        await fetch("/api/v1/orders/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, reference }),
        }),
      );
      setOrder(body.data.order);
      setStatusUrl(body.data.statusUrl);
    } catch (err) {
      setOrder(null);
      setStatusUrl(null);
      setError(err instanceof Error ? err.message : "Order status not found.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!statusUrl) return;
    try {
      await navigator.clipboard.writeText(statusUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="tora-cart-page">
      <div className="tora-cart-page__crumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Order status</span>
      </div>
      <div className="tora-cart-page__inner">
        <header className="tora-cart-page__heading">
          <PackageCheck aria-hidden className="h-6 w-6" />
          <div>
            <p>Store order</p>
            <h1>Order status</h1>
          </div>
        </header>

        <div className="tora-order-status">
          <form className="tora-order-status__lookup" onSubmit={lookup}>
            <div>
              <h2>Find an order</h2>
              <p>
                Use the email from checkout and either the order number or invoice
                number.
              </p>
            </div>
            <label>
              Email
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Order or invoice number
              <input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Order ID or INV-..."
                required
              />
            </label>
            <button type="submit" disabled={loading}>
              <Search aria-hidden className="h-4 w-4" />
              {loading ? "Checking..." : "Check status"}
            </button>
            {error && <p className="tora-order-status__error">{error}</p>}
          </form>

          <div className="tora-order-status__result">
            {loading && !order ? (
              <div className="tora-cart-empty">Loading order status...</div>
            ) : order ? (
              <article className="tora-order-confirmation">
                <div className="tora-order-confirmation__hero">
                  <CheckCircle2 aria-hidden className="h-8 w-8" />
                  <div>
                    <p>
                      {order.invoice?.number ?? "Order"} · Updated{" "}
                      {formatDate(order.updatedAt)}
                    </p>
                    <h2>{order.id}</h2>
                    {(order.customerName || order.maskedEmail) && (
                      <span className="tora-order-status__identity">
                        {order.customerName}
                        {order.customerName && order.maskedEmail ? " · " : ""}
                        {order.maskedEmail}
                      </span>
                    )}
                  </div>
                </div>

                {nextStep && (
                  <div className="tora-order-status__next">
                    <Clock3 aria-hidden className="h-5 w-5" />
                    <div>
                      <strong>{nextStep.title}</strong>
                      <p>{nextStep.body}</p>
                    </div>
                  </div>
                )}

                <div className="tora-order-confirmation__grid">
                  <div>
                    <span>Order</span>
                    <strong>{label(order.status)}</strong>
                  </div>
                  <div>
                    <span>Payment</span>
                    <strong>
                      {order.invoice
                        ? label(order.invoice.onlinePaymentStatus ?? order.invoice.status)
                        : "Awaiting invoice"}
                    </strong>
                  </div>
                  <div>
                    <span>Fulfillment</span>
                    <strong>{label(order.fulfillmentStatus)}</strong>
                  </div>
                  <div>
                    <span>Shipping</span>
                    <strong>{shippingText(order)}</strong>
                  </div>
                </div>

                <div className="tora-order-status__timeline" aria-label="Order progress">
                  {timeline.map(({ title, body, date, state, Icon }, index) => (
                    <div
                      key={title}
                      className={`is-${state}`}
                      aria-current={state === "current" ? "step" : undefined}
                    >
                      <span>
                        <Icon aria-hidden className="h-4 w-4" />
                        <i>{index + 1}</i>
                      </span>
                      <strong>{title}</strong>
                      <p>{body}</p>
                      <time>{formatDate(date ?? null)}</time>
                    </div>
                  ))}
                </div>

                {(order.fulfillmentCarrier ||
                  order.fulfillmentTrackingNumber ||
                  order.fulfillmentTrackingUrl) && (
                  <div className="tora-order-confirmation__message">
                    <h3>Tracking</h3>
                    <div className="tora-order-status__tracking">
                      {order.fulfillmentCarrier && (
                        <p>
                          <span>Carrier</span>
                          <strong>{order.fulfillmentCarrier}</strong>
                        </p>
                      )}
                      {order.fulfillmentTrackingNumber && (
                        <p>
                          <span>Tracking</span>
                          <strong>{order.fulfillmentTrackingNumber}</strong>
                        </p>
                      )}
                      {!order.fulfillmentCarrier &&
                        !order.fulfillmentTrackingNumber && (
                          <p>Shipment details are available.</p>
                        )}
                    </div>
                    {order.fulfillmentTrackingUrl && (
                      <a
                        href={order.fulfillmentTrackingUrl}
                        className="tora-cart-action"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Truck aria-hidden className="h-4 w-4" />
                        Track shipment
                      </a>
                    )}
                  </div>
                )}

                <div className="tora-order-confirmation__items">
                  {order.items.map((item) => (
                    <article key={item.id}>
                      <div>
                        <h3>{orderItemTitle(item)}</h3>
                        {item.options.length > 0 && (
                          <ul>
                            {item.options.map((option) => (
                              <li key={`${item.id}-${option.optionId}`}>
                                {optionLine(option, order.currency)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <span>Qty {item.quantity}</span>
                      <strong>
                        {formatMoney(item.lineTotalCents, order.currency)}
                      </strong>
                    </article>
                  ))}
                </div>

                <div className="tora-order-confirmation__totals">
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatMoney(order.subtotalCents, order.currency)}
                    </strong>
                  </div>
                  {order.discountCents > 0 && (
                    <div>
                      <span>
                        Discount{order.promoCode ? ` · ${order.promoCode}` : ""}
                      </span>
                      <strong>
                        -{formatMoney(order.discountCents, order.currency)}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>Tax</span>
                    <strong>{formatMoney(order.taxCents, order.currency)}</strong>
                  </div>
                  <div>
                    <span>
                      Shipping
                      {order.shippingProfileLabel
                        ? ` · ${order.shippingProfileLabel}`
                        : ""}
                    </span>
                    <strong>
                      {formatMoney(order.shippingCents, order.currency)}
                    </strong>
                  </div>
                  {refundedCents > 0 && (
                    <div>
                      <span>Refunded</span>
                      <strong>
                        {formatMoney(refundedCents, order.currency)}
                      </strong>
                    </div>
                  )}
                  {pendingRefundCents > 0 && (
                    <div>
                      <span>Pending refund</span>
                      <strong>
                        {formatMoney(pendingRefundCents, order.currency)}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>Total</span>
                    <strong>{formatMoney(order.totalCents, order.currency)}</strong>
                  </div>
                </div>

                <div className="tora-order-confirmation__actions">
                  {statusUrl && (
                    <button
                      type="button"
                      className="tora-cart-action tora-cart-action--ghost"
                      onClick={copyLink}
                    >
                      <Copy aria-hidden className="h-4 w-4" />
                      {copied ? "Link copied" : "Copy status link"}
                    </button>
                  )}
                  <Link href="/cart" className="tora-cart-action">
                    Back to cart
                  </Link>
                </div>
              </article>
            ) : (
              <div className="tora-cart-empty">
                <h2>Track an order</h2>
                <p>
                  Status, payment, tracking, and refund updates will appear here
                  after the studio updates your order.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
