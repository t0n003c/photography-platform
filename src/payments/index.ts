import { getEnv } from "@/src/lib/env";
import { getResolvedStorePaymentConfig } from "@/src/db/queries/settings";
import { storePaymentStatus } from "@/src/lib/store-settings";
import type { PaymentProvider } from "@/src/payments/provider";
import { StripePaymentProvider } from "@/src/payments/drivers/stripe";

export type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutSession,
  PaymentProviderReadiness,
} from "@/src/payments/provider";

// Hosted payments are still deferred. Manual invoice checkout is active; this
// legacy env switch only gates the unfinished hosted-checkout branch.
export function isPaymentsEnabled(): boolean {
  return getEnv().PAYMENTS_DRIVER !== "stub";
}

export async function getPaymentProviderReadiness() {
  const config = await getResolvedStorePaymentConfig();
  const status = storePaymentStatus(config);
  return {
    activeCheckoutPath: status.activeCheckoutPath,
    configuredProvider: config.paymentProvider,
    mode: config.paymentMode,
    hostedCheckoutReady: status.readyForHostedCheckout,
    missing: status.missing,
  };
}

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  provider ??= new StripePaymentProvider();
  return provider;
}
