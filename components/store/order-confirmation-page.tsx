"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShoppingBag } from "lucide-react";
import {
  storeOrderConfirmationStorageKey,
  type StoreOrderConfirmation,
} from "@/src/lib/store-order-confirmation";
import {
  normalizeStoreCheckoutSettings,
  publicStoreCheckoutSettings,
} from "@/src/lib/store-settings";

interface StoreOrderConfirmationPageProps {
  orderId: string | null;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shippingText(confirmation: StoreOrderConfirmation) {
  if (confirmation.shippingCents > 0) {
    return formatMoney(confirmation.shippingCents, confirmation.currency);
  }
  if (confirmation.checkoutSettings.shippingMode === "free") return "Free";
  if (confirmation.checkoutSettings.shippingMode === "manual") {
    return "Quoted after review";
  }
  return formatMoney(0, confirmation.currency);
}

function parseConfirmation(value: string | null, orderId: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as StoreOrderConfirmation;
    if (parsed.orderId !== orderId) return null;
    return {
      ...parsed,
      taxCents: parsed.taxCents ?? 0,
      shippingCents: parsed.shippingCents ?? 0,
      checkoutSettings: publicStoreCheckoutSettings(
        normalizeStoreCheckoutSettings(parsed.checkoutSettings ?? {}),
      ),
    };
  } catch {
    return null;
  }
}

export function StoreOrderConfirmationPage({
  orderId,
}: StoreOrderConfirmationPageProps) {
  const [loaded, setLoaded] = useState(false);
  const [confirmation, setConfirmation] = useState<StoreOrderConfirmation | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoaded(true);
      return;
    }
    try {
      setConfirmation(
        parseConfirmation(
          sessionStorage.getItem(storeOrderConfirmationStorageKey(orderId)),
          orderId,
        ),
      );
    } catch {
      setConfirmation(null);
    } finally {
      setLoaded(true);
    }
  }, [orderId]);

  return (
    <section className="tora-cart-page">
      <div className="tora-cart-page__crumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/cart">Cart</Link>
        <span>/</span>
        <span>Confirmation</span>
      </div>
      <div className="tora-cart-page__inner">
        <header className="tora-cart-page__heading">
          <ShoppingBag aria-hidden className="h-6 w-6" />
          <div>
            <p>
              {confirmation?.checkoutSettings.checkoutLabel ??
                "Manual invoice checkout"}
            </p>
            <h1>Order confirmation</h1>
          </div>
        </header>

        {!loaded ? (
          <div className="tora-cart-empty">Loading order confirmation...</div>
        ) : !orderId ? (
          <div className="tora-cart-empty">
            <h2>No order selected</h2>
            <p>Return to the cart to submit an order request.</p>
            <Link href="/cart" className="tora-cart-action">
              Return to cart
            </Link>
          </div>
        ) : confirmation ? (
          <div className="tora-order-confirmation">
            <div className="tora-order-confirmation__hero">
              <CheckCircle2 aria-hidden className="h-8 w-8" />
              <div>
                <p>Order request received</p>
                <h2>{confirmation.orderId}</h2>
              </div>
            </div>

            <div className="tora-order-confirmation__grid">
              <div>
                <span>Status</span>
                <strong>{confirmation.status}</strong>
              </div>
              <div>
                <span>Received</span>
                <strong>{formatDate(confirmation.createdAt)}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{confirmation.customerEmail}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>
                  {formatMoney(confirmation.totalCents, confirmation.currency)}
                </strong>
              </div>
            </div>

            <div className="tora-order-confirmation__message">
              <h3>What happens next</h3>
              <p>{confirmation.checkoutSettings.confirmationMessage}</p>
              <p>A confirmation email has been sent with this same summary.</p>
            </div>

            <div className="tora-order-confirmation__items">
              {confirmation.lines.map((line, index) => (
                <article key={`${line.productId}-${line.sku}-${index}`}>
                  <div>
                    <h3>{line.productName}</h3>
                    <p>{line.sku}</p>
                    {line.selectedOptions.length > 0 && (
                      <ul>
                        {line.selectedOptions.map((option) => (
                          <li key={option.optionId}>
                            {option.optionName}: {option.valueLabel}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span>Qty {line.quantity}</span>
                  <strong>
                    {formatMoney(line.lineTotalCents, confirmation.currency)}
                  </strong>
                </article>
              ))}
            </div>

            <div className="tora-order-confirmation__totals">
              <div>
                <span>Subtotal</span>
                <strong>
                  {formatMoney(confirmation.subtotalCents, confirmation.currency)}
                </strong>
              </div>
              <div>
                <span>Tax</span>
                <strong>
                  {formatMoney(confirmation.taxCents, confirmation.currency)}
                </strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{shippingText(confirmation)}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>
                  {formatMoney(confirmation.totalCents, confirmation.currency)}
                </strong>
              </div>
            </div>

            <div className="tora-order-confirmation__actions">
              <Link href="/" className="tora-cart-action">
                Continue browsing
              </Link>
              <Link href="/cart" className="tora-cart-action tora-cart-action--ghost">
                Back to cart
              </Link>
            </div>
          </div>
        ) : (
          <div className="tora-cart-empty">
            <h2>Order request received</h2>
            <p>
              We could not load the full receipt from this browser, but the request
              number below can be used for follow-up.
            </p>
            <strong className="tora-order-confirmation__fallback">{orderId}</strong>
            <p>Check your email for the itemized confirmation.</p>
            <Link href="/" className="tora-cart-action">
              Continue browsing
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
