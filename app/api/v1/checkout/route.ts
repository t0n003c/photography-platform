import { problem } from "@/src/lib/http";
import { isPaymentsEnabled } from "@/src/payments";

export const dynamic = "force-dynamic";

// POST /api/v1/checkout — gated on the PaymentProvider seam. Payments are
// deferred (PAYMENTS_DRIVER=stub), so this returns 501; invoices are sent
// manually for now. When a real driver is wired, replace this branch with
// getPaymentProvider().createCheckout(...).
export async function POST() {
  if (!isPaymentsEnabled()) {
    return problem(
      501,
      "PAYMENTS_NOT_ENABLED",
      "Checkout is not available yet. An invoice will be sent manually.",
    );
  }
  // Unreachable while stubbed — the seam is here for the future driver.
  return problem(501, "PAYMENTS_NOT_ENABLED", "Checkout is not available yet.");
}
