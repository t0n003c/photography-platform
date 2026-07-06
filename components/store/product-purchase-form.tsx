"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { addStoredCartItem } from "@/src/lib/store-cart";
import type {
  ProductOption,
  ProductOptionSelectionInput,
} from "@/src/lib/store-options";
import { inventoryAvailable, optionValueAvailable } from "@/src/lib/store-inventory";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDelta(cents: number, currency: string) {
  if (cents === 0) return "";
  const prefix = cents > 0 ? "+" : "-";
  return ` ${prefix}${formatMoney(Math.abs(cents), currency)}`;
}

function initialSelection(options: ProductOption[]): ProductOptionSelectionInput {
  return Object.fromEntries(
    options.flatMap((option) => {
      const first =
        option.values.find((value) => optionValueAvailable(value).available) ??
        option.values[0];
      if (!option.required || !first) return [];
      return [[option.id, first.id]];
    }),
  );
}

export function ProductPurchaseForm({
  productId,
  currency,
  basePriceCents,
  inventoryTracked,
  stockQuantity,
  lowStockThreshold,
  allowBackorder,
  options,
}: {
  productId: string;
  currency: string;
  basePriceCents: number;
  inventoryTracked: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  options: ProductOption[];
}) {
  const [selection, setSelection] = useState<ProductOptionSelectionInput>(() =>
    initialSelection(options),
  );
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 5000);
    return () => window.clearTimeout(timer);
  }, [added]);

  const optionDeltaCents = useMemo(
    () =>
      options.reduce((sum, option) => {
        const value = option.values.find((item) => item.id === selection[option.id]);
        return sum + (value?.priceDeltaCents ?? 0);
      }, 0),
    [options, selection],
  );

  const finalPriceCents = Math.max(0, basePriceCents + optionDeltaCents);
  const productAvailability = inventoryAvailable({
    inventoryTracked,
    stockQuantity,
    lowStockThreshold,
    allowBackorder,
  });
  const selectedUnavailable = options
    .map((option) => {
      const value = option.values.find((item) => item.id === selection[option.id]);
      if (!value) return null;
      const availability = optionValueAvailable(value);
      return availability.available ? null : `${option.name}: ${value.label}`;
    })
    .find(Boolean);
  const canAdd = productAvailability.available && !selectedUnavailable;

  function addToCart() {
    if (!productAvailability.available) {
      setError("This product is sold out.");
      return;
    }
    if (selectedUnavailable) {
      setError(`${selectedUnavailable} is sold out.`);
      return;
    }
    const missing = options.find((option) => option.required && !selection[option.id]);
    if (missing) {
      setError(`Choose ${missing.name.toLowerCase()} before adding this product.`);
      return;
    }
    setError(null);
    addStoredCartItem(productId, 1, selection);
    setAdded(true);
  }

  return (
    <div className="tora-product-options">
      {options.length > 0 && (
        <div className="tora-product-options__fields">
          {options.map((option) => (
            <label key={option.id}>
              <span>{option.name}</span>
              <select
                required={option.required}
                value={selection[option.id] ?? ""}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    [option.id]: event.target.value,
                  }))
                }
              >
                {!option.required && <option value="">No preference</option>}
                {option.values.map((value) => {
                  const availability = optionValueAvailable(value);
                  return (
                    <option
                      key={value.id}
                      value={value.id}
                      disabled={!availability.available}
                    >
                      {value.label}
                      {formatDelta(value.priceDeltaCents, currency)}
                      {!availability.available ? " — sold out" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
          ))}
        </div>
      )}

      {inventoryTracked && (
        <p className="tora-product-options__stock">
          {productAvailability.label}
          {productAvailability.status !== "sold_out" ? ` · ${stockQuantity}` : ""}
        </p>
      )}

      {options.length > 0 && (
        <p className="tora-product-options__price">
          Selected total <strong>{formatMoney(finalPriceCents, currency)}</strong>
        </p>
      )}

      {error && <p className="tora-product-options__error">{error}</p>}

      <div className="tora-add-to-cart">
        <button
          type="button"
          className="tora-add-to-cart__button"
          onClick={addToCart}
          disabled={!canAdd}
        >
          <ShoppingBag aria-hidden className="h-3.5 w-3.5" />
          <span>{canAdd ? (added ? "Added" : "Add to cart") : "Sold out"}</span>
        </button>
        {added && (
          <Link href="/cart" className="tora-add-to-cart__link">
            View cart
          </Link>
        )}
      </div>
    </div>
  );
}
