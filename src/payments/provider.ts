import type { StorePaymentMode, StorePaymentProvider } from "@/src/lib/store-settings";

// PaymentProvider seam. The interface and call seams exist so hosted
// invoicing/checkout can be added without reworking the store. The current
// checkout flow remains manual invoices until a real driver is deliberately
// wired to the cart/invoice routes.
export interface CheckoutLineItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  currency: string;
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
}

export interface PaymentProviderReadiness {
  activeCheckoutPath: "manual";
  configuredProvider: StorePaymentProvider;
  mode: StorePaymentMode;
  hostedCheckoutReady: boolean;
  missing: string[];
}
