import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeWebhookSignature } from "@/src/payments/stripe-webhook";

function signature(payload: string, secret: string, timestamp: number) {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

describe("Stripe webhook signatures", () => {
  it("accepts a valid signed payload inside tolerance", () => {
    const payload = JSON.stringify({ id: "evt_123" });
    const secret = "whsec_test";
    const timestamp = 1_800_000_000;
    expect(
      verifyStripeWebhookSignature(payload, signature(payload, secret, timestamp), secret, {
        nowMs: timestamp * 1000,
      }),
    ).toBe(true);
  });

  it("rejects mismatched signatures", () => {
    const payload = JSON.stringify({ id: "evt_123" });
    const timestamp = 1_800_000_000;
    expect(
      verifyStripeWebhookSignature(
        payload,
        signature(payload, "whsec_right", timestamp),
        "whsec_wrong",
        { nowMs: timestamp * 1000 },
      ),
    ).toBe(false);
  });

  it("rejects stale signatures", () => {
    const payload = JSON.stringify({ id: "evt_123" });
    const secret = "whsec_test";
    const timestamp = 1_800_000_000;
    expect(
      verifyStripeWebhookSignature(payload, signature(payload, secret, timestamp), secret, {
        nowMs: (timestamp + 301) * 1000,
      }),
    ).toBe(false);
  });
});
