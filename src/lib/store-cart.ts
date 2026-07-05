export const STORE_CART_STORAGE_KEY = "photog-store-cart-v1";
export const STORE_CART_CHANGE_EVENT = "photog-store-cart-change";

export interface StoredCartItem {
  productId: string;
  quantity: number;
}

export function normalizeStoredCart(items: StoredCartItem[]): StoredCartItem[] {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId.trim();
    if (!productId) continue;
    const quantity = Math.min(Math.max(Math.floor(item.quantity || 1), 1), 99);
    byProduct.set(productId, Math.min((byProduct.get(productId) ?? 0) + quantity, 99));
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
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
  window.dispatchEvent(new CustomEvent(STORE_CART_CHANGE_EVENT, { detail: normalized }));
}

export function addStoredCartItem(productId: string, quantity = 1) {
  const current = readStoredCart();
  writeStoredCart([...current, { productId, quantity }]);
}

export function storedCartCount(items = readStoredCart()): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
