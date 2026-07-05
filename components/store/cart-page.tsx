"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { CartSummaryDTO } from "@/src/db/queries/store";
import {
  normalizeStoredCart,
  readStoredCart,
  STORE_CART_CHANGE_EVENT,
  storedCartItemKey,
  writeStoredCart,
  type StoredCartItem,
} from "@/src/lib/store-cart";
import {
  storeOrderConfirmationStorageKey,
  type StoreOrderConfirmation,
} from "@/src/lib/store-order-confirmation";
import {
  publicStoreCheckoutSettings,
  STORE_CHECKOUT_DEFAULTS,
} from "@/src/lib/store-settings";

interface CheckoutForm {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

const emptySummary: CartSummaryDTO = {
  lines: [],
  unavailableProductIds: [],
  optionErrors: [],
  subtotalCents: 0,
  taxCents: 0,
  shippingCents: 0,
  totalCents: 0,
  currency: "USD",
  hasMixedCurrency: false,
  checkoutSettings: publicStoreCheckoutSettings(STORE_CHECKOUT_DEFAULTS),
  payment: {
    hostedCheckoutAvailable: false,
    provider: "manual",
    activeCheckoutPath: "manual",
  },
};

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message || "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function shippingSummaryText(summary: CartSummaryDTO) {
  if (summary.shippingCents > 0) {
    return formatMoney(summary.shippingCents, summary.currency);
  }
  if (summary.checkoutSettings.shippingMode === "free") return "Free";
  if (summary.checkoutSettings.shippingMode === "manual") return "Quoted after review";
  return formatMoney(0, summary.currency);
}

export function StoreCartPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<StoredCartItem[]>([]);
  const [summary, setSummary] = useState<CartSummaryDTO>(emptySummary);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    setItems(readStoredCart());
    setLoaded(true);

    function onCartChange() {
      setItems(readStoredCart());
    }
    window.addEventListener(STORE_CART_CHANGE_EVENT, onCartChange);
    window.addEventListener("storage", onCartChange);
    return () => {
      window.removeEventListener(STORE_CART_CHANGE_EVENT, onCartChange);
      window.removeEventListener("storage", onCartChange);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (items.length === 0) {
      setSummary(emptySummary);
      return;
    }

    const controller = new AbortController();
    setChecking(true);
    setError(null);
    fetch("/api/v1/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        return (await res.json()) as { data: CartSummaryDTO };
      })
      .then((body) => setSummary(body.data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not refresh cart.");
      })
      .finally(() => setChecking(false));

    return () => controller.abort();
  }, [items, loaded]);

  const itemCount = useMemo(
    () => summary.lines.reduce((sum, line) => sum + line.quantity, 0),
    [summary.lines],
  );

  function replaceCart(nextItems: StoredCartItem[]) {
    const normalized = normalizeStoredCart(nextItems);
    setItems(normalized);
    writeStoredCart(normalized);
  }

  function setQuantity(key: string, quantity: number) {
    replaceCart(
      items.map((item) =>
        storedCartItemKey(item) === key ? { ...item, quantity } : item,
      ),
    );
  }

  function remove(key: string) {
    replaceCart(items.filter((item) => storedCartItemKey(item) !== key));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (summary.lines.length === 0) {
      setError("Add at least one available product first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const checkoutItems = summary.lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      options: line.options,
    }));
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: form.name.trim() || undefined,
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            notes: form.notes.trim() || undefined,
          },
          items: checkoutItems,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const body = (await res.json()) as {
        data: StoreOrderConfirmation & { checkoutUrl?: string | null };
      };
      if (body.data.checkoutUrl) {
        replaceCart([]);
        window.location.assign(body.data.checkoutUrl);
        return;
      }
      try {
        sessionStorage.setItem(
          storeOrderConfirmationStorageKey(body.data.orderId),
          JSON.stringify(body.data),
        );
      } catch {
        // The confirmation page still has a safe fallback if storage is unavailable.
      }
      replaceCart([]);
      router.push(body.data.receiptUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit checkout request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="tora-cart-page">
      <div className="tora-cart-page__crumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <span>Cart</span>
      </div>
      <div className="tora-cart-page__inner">
        <header className="tora-cart-page__heading">
          <ShoppingBag aria-hidden className="h-6 w-6" />
          <div>
            <p>{summary.checkoutSettings.checkoutLabel}</p>
            <h1>Your cart</h1>
          </div>
        </header>

        {!loaded ? (
          <div className="tora-cart-empty">Loading cart...</div>
        ) : items.length === 0 ? (
          <div className="tora-cart-empty">
            <h2>Your cart is empty</h2>
            <p>Add prints from the shop, then submit the request here.</p>
            <Link href="/" className="tora-cart-action">
              Continue browsing
            </Link>
          </div>
        ) : items.length > 0 ? (
          <div className="tora-cart-layout">
            <div className="tora-cart-items" aria-busy={checking}>
              {summary.lines.map((line) => (
                <article className="tora-cart-item" key={line.key}>
                  <Link
                    href={`/product/${line.product.slug}`}
                    className="tora-cart-item__image"
                  >
                    {line.product.photo ? (
                      <ResponsiveImage
                        photo={line.product.photo}
                        sizes="(max-width: 767px) 34vw, 180px"
                        className="h-full w-full"
                      />
                    ) : (
                      <span />
                    )}
                  </Link>
                  <div className="tora-cart-item__body">
                    <Link href={`/product/${line.product.slug}`}>
                      {line.product.name}
                    </Link>
                    <span>{line.product.sku}</span>
                    {line.selectedOptions.length > 0 && (
                      <ul className="tora-cart-item__options">
                        {line.selectedOptions.map((option) => (
                          <li key={option.optionId}>
                            {option.optionName}: {option.valueLabel}
                          </li>
                        ))}
                      </ul>
                    )}
                    <strong>
                      {formatMoney(line.unitPriceCents, line.product.currency)}
                    </strong>
                  </div>
                  <div
                    className="tora-cart-quantity"
                    aria-label={`Quantity for ${line.product.name}`}
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                      disabled={line.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus aria-hidden className="h-3.5 w-3.5" />
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                      disabled={line.quantity >= 99}
                      aria-label="Increase quantity"
                    >
                      <Plus aria-hidden className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="tora-cart-item__total">
                    {formatMoney(line.lineTotalCents, line.product.currency)}
                  </p>
                  <button
                    type="button"
                    className="tora-cart-item__remove"
                    onClick={() => remove(line.key)}
                    aria-label={`Remove ${line.product.name}`}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </button>
                </article>
              ))}

              {summary.unavailableProductIds.length > 0 && (
                <div className="tora-cart-warning">
                  Some cart items are no longer available and were removed from checkout
                  totals.
                </div>
              )}
              {summary.optionErrors.length > 0 && (
                <div className="tora-cart-warning">
                  {summary.optionErrors.map((item) => item.message).join(" ")}
                </div>
              )}
            </div>

            <form className="tora-cart-checkout" onSubmit={submit}>
              <h2>
                {summary.payment.hostedCheckoutAvailable
                  ? "Secure checkout"
                  : "Request invoice"}
              </h2>
              <p>{summary.checkoutSettings.checkoutInstructions}</p>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                  autoComplete="email"
                />
              </label>
              <label>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </label>
              <label>
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((v) => ({ ...v, notes: e.target.value }))}
                  rows={4}
                />
              </label>
              <div className="tora-cart-summary">
                <div>
                  <span>
                    Subtotal · {itemCount} item{itemCount === 1 ? "" : "s"}
                  </span>
                  <strong>
                    {formatMoney(summary.subtotalCents, summary.currency)}
                  </strong>
                </div>
                <div>
                  <span>Tax</span>
                  <strong>{formatMoney(summary.taxCents, summary.currency)}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <strong>{shippingSummaryText(summary)}</strong>
                </div>
                <div className="is-total">
                  <span>Total</span>
                  <strong>{formatMoney(summary.totalCents, summary.currency)}</strong>
                </div>
              </div>
              {error && <p className="tora-cart-error">{error}</p>}
              <button
                type="submit"
                disabled={
                  submitting ||
                  checking ||
                  summary.lines.length === 0 ||
                  summary.optionErrors.length > 0
                }
              >
                {submitting
                  ? summary.payment.hostedCheckoutAvailable
                    ? "Opening checkout..."
                    : "Submitting..."
                  : summary.payment.hostedCheckoutAvailable
                    ? "Continue to secure payment"
                    : "Submit order request"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
