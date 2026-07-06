import type { StorePaymentMode, StorePaymentProvider } from "@/src/lib/store-settings";

// PaymentProvider seam. Public checkout can stay on manual invoices or switch
// to hosted sessions through Settings -> Payments without changing store UI.
export interface CheckoutLineItem {
  description: string;
  amountCents: number;
  quantity: number;
  taxCode?: string | null;
}

export interface CreateCheckoutInput {
  orderId: string;
  invoiceId: string;
  customerEmail?: string | null;
  currency: string;
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  automaticTax?: boolean;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface CheckoutSession {
  id: string;
  url: string;
  paymentIntentId: string | null;
  expiresAt: Date | null;
}

export type PaymentRefundStatus = "pending" | "succeeded" | "failed" | "cancelled";

export interface CreateRefundInput {
  refundId: string;
  orderId: string;
  invoiceId: string;
  paymentIntentId: string;
  amountCents: number;
  currency: string;
  reason?: string | null;
  note?: string | null;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface PaymentRefund {
  id: string;
  amountCents: number;
  currency: string;
  status: PaymentRefundStatus;
  providerStatus: string | null;
  failureReason: string | null;
  createdAt: Date | null;
}

export interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  createRefund(input: CreateRefundInput): Promise<PaymentRefund>;
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
