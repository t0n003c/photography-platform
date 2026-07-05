import type { StorePaymentMode, StorePaymentProvider } from "@/src/lib/store-settings";

// PaymentProvider seam. Public checkout can stay on manual invoices or switch
// to hosted sessions through Settings -> Payments without changing store UI.
export interface CheckoutLineItem {
  description: string;
  amountCents: number;
  quantity: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  invoiceId: string;
  customerEmail?: string | null;
  currency: string;
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  paymentIntentId: string | null;
  expiresAt: Date | null;
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
}

export interface PaymentProviderReadiness {
  activeCheckoutPath: "manual" | "hosted";
  configuredProvider: StorePaymentProvider;
  mode: StorePaymentMode;
  hostedCheckoutReady: boolean;
  missing: string[];
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code = "PAYMENT_PROVIDER_ERROR",
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
