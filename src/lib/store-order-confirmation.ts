import type { SelectedProductOption } from "@/src/lib/store-options";
import type { PublicStoreCheckoutSettings } from "@/src/lib/store-settings";

export const STORE_ORDER_CONFIRMATION_STORAGE_PREFIX = "photog-order-confirmation-v1:";

export interface StoreOrderConfirmationLine {
  productId: string;
  productSlug: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  selectedOptions: SelectedProductOption[];
}

export interface StoreOrderConfirmation {
  orderId: string;
  status: "pending";
  customerName: string | null;
  customerEmail: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  receiptUrl: string;
  checkoutSettings: PublicStoreCheckoutSettings;
  lines: StoreOrderConfirmationLine[];
}

export function storeOrderConfirmationStorageKey(orderId: string) {
  return `${STORE_ORDER_CONFIRMATION_STORAGE_PREFIX}${orderId}`;
}
