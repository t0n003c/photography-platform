import { afterEach, describe, expect, it, vi } from "vitest";
import { StripePaymentProvider } from "@/src/payments/drivers/stripe";

describe("StripePaymentProvider refunds", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates a PaymentIntent refund with metadata and an idempotency key", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("payment_intent")).toBe("pi_test_123");
      expect(body.get("amount")).toBe("2500");
      expect(body.get("metadata[orderId]")).toBe("order-1");
      expect(body.get("metadata[invoiceId]")).toBe("invoice-1");
      expect(body.get("metadata[localRefundId]")).toBe("refund-1");
      expect(new Headers(init?.headers).get("Idempotency-Key")).toBe(
        "order-refund-refund-1",
      );
      return new Response(
        JSON.stringify({
          id: "re_test_123",
          amount: 2500,
          currency: "usd",
          status: "succeeded",
          created: 1783298000,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new StripePaymentProvider({ secretKey: "sk_test_demo" });
    const refund = await provider.createRefund({
      refundId: "refund-1",
      orderId: "order-1",
      invoiceId: "invoice-1",
      paymentIntentId: "pi_test_123",
      amountCents: 2500,
      currency: "USD",
      reason: "Client change",
      note: "Partial refund.",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/refunds",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refund).toMatchObject({
      id: "re_test_123",
      amountCents: 2500,
      currency: "USD",
      status: "succeeded",
      providerStatus: "succeeded",
      failureReason: null,
    });
  });

  it("maps failed provider responses into refund failure details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "re_test_failed",
            amount: 500,
            currency: "usd",
            status: "failed",
            failure_reason: "expired_or_canceled_card",
          }),
          { status: 200 },
        ),
      ),
    );

    const provider = new StripePaymentProvider({ secretKey: "sk_test_demo" });
    const refund = await provider.createRefund({
      refundId: "refund-2",
      orderId: "order-1",
      invoiceId: "invoice-1",
      paymentIntentId: "pi_test_123",
      amountCents: 500,
      currency: "USD",
    });

    expect(refund.status).toBe("failed");
    expect(refund.failureReason).toBe("expired_or_canceled_card");
  });
});
