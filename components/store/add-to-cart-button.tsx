"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { addStoredCartItem } from "@/src/lib/store-cart";
import { cn } from "@/src/lib/utils";

export function AddToCartButton({
  productId,
  label = "Add to cart",
  compact = false,
  disabled = false,
}: {
  productId: string;
  label?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 5000);
    return () => window.clearTimeout(timer);
  }, [added]);

  return (
    <div className={cn("tora-add-to-cart", compact && "is-compact")}>
      <button
        type="button"
        className="tora-add-to-cart__button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          addStoredCartItem(productId);
          setAdded(true);
        }}
      >
        <ShoppingBag aria-hidden className="h-3.5 w-3.5" />
        <span>{added ? "Added" : label}</span>
      </button>
      {added && (
        <Link href="/cart" className="tora-add-to-cart__link">
          View cart
        </Link>
      )}
    </div>
  );
}
