import { describe, expect, it } from "vitest";
import {
  calculateStoreTotals,
  normalizeStoreCheckoutSettings,
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
});
