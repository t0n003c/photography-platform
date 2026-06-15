// PaymentProvider seam — DEFERRED. The interface and call seams exist so
// invoicing/checkout can be added later (Stripe likely) without reworking
// the store. No real payment logic is built now.
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
