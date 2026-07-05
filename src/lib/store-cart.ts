import {
  normalizeOptionSelection,
  optionSelectionKey,
  type ProductOptionSelectionInput,
} from "@/src/lib/store-options";

export const STORE_CART_STORAGE_KEY = "photog-store-cart-v1";
export const STORE_CART_CHANGE_EVENT = "photog-store-cart-change";

export interface StoredCartItem {
  productId: string;
  quantity: number;
  options?: ProductOptionSelectionInput;
}

export function storedCartItemKey(item: Pick<StoredCartItem, "productId" | "options">) {
  return `${item.productId.trim()}:${optionSelectionKey(item.options)}`;
}

export function normalizeStoredCart(items: StoredCartItem[]): StoredCartItem[] {
  const byProduct = new Map<string, StoredCartItem>();
  for (const item of items) {
    const productId = item.productId.trim();
    if (!productId) continue;
    const quantity = Math.min(Math.max(Math.floor(item.quantity || 1), 1), 99);
    const options = normalizeOptionSelection(item.options);
    const nextItem: StoredCartItem = {
      productId,
      quantity,
      ...(Object.keys(options).length ? { options } : {}),
    };
    const key = storedCartItemKey(nextItem);
    const current = byProduct.get(key);
    byProduct.set(key, {
      ...nextItem,
      quantity: Math.min((current?.quantity ?? 0) + quantity, 99),
    });
  }
  return [...byProduct.values()];
}

export function readStoredCart(): StoredCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCartItem[];
    return normalizeStoredCart(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export function writeStoredCart(items: StoredCartItem[]) {
  if (typeof window === "undefined") return;
  const normalized = normalizeStoredCart(items);
  window.localStorage.setItem(STORE_CART_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(
    new CustomEvent(STORE_CART_CHANGE_EVENT, { detail: normalized }),
  );
}

export function addStoredCartItem(
  productId: string,
  quantity = 1,
  options?: ProductOptionSelectionInput,
) {
  const current = readStoredCart();
  writeStoredCart([...current, { productId, quantity, options }]);
}

export function storedCartCount(items = readStoredCart()): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
