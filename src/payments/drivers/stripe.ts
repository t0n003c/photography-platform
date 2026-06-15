import type {
  CreateCheckoutInput,
  CheckoutSession,
  PaymentProvider,
} from "@/src/payments/provider";

// STUB driver — intentionally unimplemented. Proves the seam compiles; the
// Stripe implementation is deferred until invoicing/checkout is approved.
export class StripePaymentProvider implements PaymentProvider {
  async createCheckout(
    _input: CreateCheckoutInput,
  ): Promise<CheckoutSession> {
    throw new Error("Payments are deferred — Stripe driver is a stub");
  }
}
