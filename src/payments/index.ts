import { getEnv } from "@/src/lib/env";
import { getResolvedStorePaymentConfig } from "@/src/db/queries/settings";
import { storePaymentStatus } from "@/src/lib/store-settings";
import type { PaymentProvider } from "@/src/payments/provider";
import { PaymentProviderError } from "@/src/payments/provider";
import { StripePaymentProvider } from "@/src/payments/drivers/stripe";

export type {
  PaymentProvider,
  CreateCheckoutInput,
  CheckoutSession,
  PaymentProviderReadiness,
} from "@/src/payments/provider";
export { PaymentProviderError } from "@/src/payments/provider";

// Legacy env switch retained for older call sites. Public checkout now uses the
// Settings -> Payments readiness helper below instead of this flag.
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

export async function getPaymentProvider(): Promise<PaymentProvider> {
  const config = await getResolvedStorePaymentConfig();
  const status = storePaymentStatus(config);
  if (
    config.paymentProvider !== "stripe" ||
    !config.stripeSecretKey ||
    !status.readyForHostedCheckout
  ) {
    throw new PaymentProviderError(
      status.missing.length
        ? `Stripe is missing: ${status.missing.join(", ")}.`
        : "Stripe is not configured for hosted checkout.",
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
    );
  }
  return new StripePaymentProvider({
    secretKey: config.stripeSecretKey,
    statementDescriptor: config.stripeStatementDescriptor,
  });
}
