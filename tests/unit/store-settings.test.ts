import { describe, expect, it } from "vitest";
import {
  calculateStoreTotals,
  normalizeStoreCheckoutSettings,
  normalizeStorePaymentSettings,
  storePaymentStatus,
} from "@/src/lib/store-settings";

describe("store checkout settings", () => {
  it("calculates tax and flat shipping from normalized settings", () => {
    const settings = normalizeStoreCheckoutSettings({
      taxEnabled: true,
      taxRateBps: 825,
      shippingMode: "flat",
      shippingFlatCents: 1200,
    });
    expect(calculateStoreTotals(13900, settings)).toEqual({
      taxCents: 1147,
      shippingCents: 1200,
      totalCents: 16247,
    });
  });

  it("does not add tax or shipping for an empty cart", () => {
    const settings = normalizeStoreCheckoutSettings({
      taxEnabled: true,
      taxRateBps: 10000,
      shippingMode: "flat",
      shippingFlatCents: 9999,
    });
    expect(calculateStoreTotals(0, settings)).toEqual({
      taxCents: 0,
      shippingCents: 0,
      totalCents: 0,
    });
  });

  it("keeps hosted payments off for manual checkout", () => {
    const settings = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "manual",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: true,
    });
    expect(settings.onlinePaymentsEnabled).toBe(false);
    expect(storePaymentStatus(settings)).toMatchObject({
      activeCheckoutPath: "manual",
      readyForHostedCheckout: false,
      label: "Manual invoice checkout",
    });
  });

  it("reports missing Stripe readiness fields without exposing secret values", () => {
    const settings = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "stripe",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: false,
      stripeWebhookSecretSet: true,
    });
    expect(storePaymentStatus(settings)).toMatchObject({
      activeCheckoutPath: "manual",
      readyForHostedCheckout: false,
      missing: ["Stripe secret key"],
      label: "Stripe settings incomplete",
    });
  });

  it("marks Stripe ready when readiness and required keys are present", () => {
    const settings = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "stripe",
      paymentMode: "live",
      stripePublishableKey: "pk_live_demo",
      stripeSecretKeySet: true,
      stripeWebhookSecretSet: true,
      stripeStatementDescriptor: "A very long studio statement descriptor",
    });
    expect(settings.stripeStatementDescriptor).toHaveLength(22);
    expect(storePaymentStatus(settings)).toMatchObject({
      activeCheckoutPath: "hosted",
      readyForHostedCheckout: true,
      label: "Stripe settings ready",
    });
  });

  it("requires a Stripe webhook secret before hosted checkout becomes active", () => {
    const settings = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "stripe",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: true,
      stripeWebhookSecretSet: false,
    });
    expect(storePaymentStatus(settings)).toMatchObject({
      activeCheckoutPath: "manual",
      readyForHostedCheckout: false,
      missing: ["Stripe webhook secret"],
    });
  });
});
