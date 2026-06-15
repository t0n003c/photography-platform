import { problem } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// POST /api/v1/checkout — payments deferred behind a PaymentProvider stub.
// Always 501 until Phase 6; invoices are sent manually for now.
export async function POST() {
  return problem(
    501,
    "PAYMENTS_NOT_ENABLED",
    "Checkout is not available yet. An invoice will be sent manually.",
  );
}
