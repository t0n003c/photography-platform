import { getEnv } from "@/src/lib/env";
import type { PaymentProvider } from "@/src/payments/provider";
import { StripePaymentProvider } from "@/src/payments/drivers/stripe";

export type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutSession,
} from "@/src/payments/provider";

// Payments are DEFERRED. The seam exists so a real driver (Stripe) is additive:
// flip PAYMENTS_DRIVER and implement the stub. Today this stays disabled.
export function isPaymentsEnabled(): boolean {
  return getEnv().PAYMENTS_DRIVER !== "stub";
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  provider ??= new StripePaymentProvider();
  return provider;
}
