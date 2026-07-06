import { describe, expect, it } from "vitest";
import {
  calculateStoreTotals,
  effectiveInvoiceTaxMode,
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
    expect(calculateStoreTotals(13900, settings)).toMatchObject({
      discountCents: 0,
      taxCents: 1147,
      shippingCents: 1200,
      totalCents: 16247,
      promo: null,
      promoError: null,
    });
  });

  it("does not add tax or shipping for an empty cart", () => {
    const settings = normalizeStoreCheckoutSettings({
      taxEnabled: true,
      taxRateBps: 10000,
      shippingMode: "flat",
      shippingFlatCents: 9999,
    });
    expect(calculateStoreTotals(0, settings)).toMatchObject({
      discountCents: 0,
      taxCents: 0,
      shippingCents: 0,
      totalCents: 0,
      promo: null,
      promoError: null,
    });
  });

  it("applies promo codes before tax and shipping profiles", () => {
    const settings = normalizeStoreCheckoutSettings({
      taxEnabled: true,
      taxRateBps: 1000,
      shippingProfiles: [
        {
          id: "domestic",
          label: "Domestic shipping",
          mode: "flat",
          amountCents: 1500,
          freeThresholdCents: 10000,
          enabled: true,
        },
      ],
      promoCodes: [
        {
          id: "promo-1",
          code: "SAVE20",
          label: "Save 20%",
          active: true,
          discountType: "percent",
          amountCents: 0,
          percentBps: 2000,
          minimumSubtotalCents: 0,
          usageLimit: null,
          expiresAt: null,
        },
      ],
    });

    expect(
      calculateStoreTotals(12000, settings, {
        shippingProfileId: "domestic",
        promoCode: " save20 ",
      }),
    ).toMatchObject({
      discountCents: 2400,
      taxCents: 960,
      shippingCents: 1500,
      totalCents: 12060,
      promo: { code: "SAVE20", label: "Save 20%", discountCents: 2400 },
      promoError: null,
      shippingProfile: { id: "domestic", label: "Domestic shipping" },
    });
  });

  it("keeps hosted payments off for manual checkout", () => {
    const settings = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "manual",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: true,
      stripeTaxEnabled: true,
      invoiceTaxMode: "stripe",
      stripeShippingTaxCode: "txcd_shipping",
    });
    expect(settings.onlinePaymentsEnabled).toBe(false);
    expect(settings.stripeTaxEnabled).toBe(false);
    expect(settings.invoiceTaxMode).toBe("fixed");
    expect(settings.stripeShippingTaxCode).toBeNull();
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
      stripeTaxEnabled: true,
      invoiceTaxMode: "stripe",
      stripeShippingTaxCode: " txcd_shipping ",
      stripeStatementDescriptor: "A very long studio statement descriptor",
    });
    expect(settings.stripeTaxEnabled).toBe(true);
    expect(settings.invoiceTaxMode).toBe("stripe");
    expect(settings.stripeShippingTaxCode).toBe("txcd_shipping");
    expect(settings.stripeStatementDescriptor).toHaveLength(22);
    expect(storePaymentStatus(settings)).toMatchObject({
      activeCheckoutPath: "hosted",
      readyForHostedCheckout: true,
      label: "Stripe settings ready",
    });
    expect(effectiveInvoiceTaxMode(settings)).toBe("stripe");
  });

  it("keeps invoice links on fixed totals unless Stripe Tax is both enabled and ready", () => {
    const missingWebhook = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "stripe",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: true,
      stripeWebhookSecretSet: false,
      stripeTaxEnabled: true,
      invoiceTaxMode: "stripe",
    });
    expect(missingWebhook.invoiceTaxMode).toBe("stripe");
    expect(effectiveInvoiceTaxMode(missingWebhook)).toBe("fixed");

    const taxDisabled = normalizeStorePaymentSettings({
      onlinePaymentsEnabled: true,
      paymentProvider: "stripe",
      stripePublishableKey: "pk_test_demo",
      stripeSecretKeySet: true,
      stripeWebhookSecretSet: true,
      stripeTaxEnabled: false,
      invoiceTaxMode: "stripe",
    });
    expect(taxDisabled.invoiceTaxMode).toBe("fixed");
    expect(effectiveInvoiceTaxMode(taxDisabled)).toBe("fixed");
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
