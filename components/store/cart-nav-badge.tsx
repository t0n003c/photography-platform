"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import {
  readStoredCart,
  STORE_CART_CHANGE_EVENT,
  storedCartCount,
} from "@/src/lib/store-cart";

export function CartNavBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(storedCartCount(readStoredCart()));
    refresh();
    window.addEventListener(STORE_CART_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(STORE_CART_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border text-[hsl(var(--foreground))] transition-colors hover:bg-[hsl(var(--muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"}
    >
      <ShoppingBag aria-hidden className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[hsl(var(--primary))] px-1 text-center text-[10px] font-semibold leading-4 text-[hsl(var(--primary-foreground))]">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
