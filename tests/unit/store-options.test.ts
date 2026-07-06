import { describe, expect, it } from "vitest";
import { normalizeProductOptions, optionSelectionKey } from "@/src/lib/store-options";
import { normalizeStoredCart } from "@/src/lib/store-cart";

describe("store product options", () => {
  it("normalizes option definitions and removes incomplete entries", () => {
    const options = normalizeProductOptions([
      {
        id: " Size ",
        name: " Size ",
        values: [
          { id: "small", label: "Small", priceDeltaCents: 0 },
          { id: "large", label: "Large", priceDeltaCents: 2500 },
          { id: "empty", label: " " },
        ],
      },
      { id: "finish", name: "", values: [{ label: "Matte" }] },
    ]);

    expect(options).toEqual([
      {
        id: "size",
        name: "Size",
        required: true,
        values: [
          {
            id: "small",
            label: "Small",
            priceDeltaCents: 0,
            inventoryTracked: false,
            stockQuantity: 0,
            lowStockThreshold: 0,
            allowBackorder: false,
          },
          {
            id: "large",
            label: "Large",
            priceDeltaCents: 2500,
            inventoryTracked: false,
            stockQuantity: 0,
            lowStockThreshold: 0,
            allowBackorder: false,
          },
        ],
      },
    ]);
  });

  it("keeps cart lines separate when selected options differ", () => {
    const cart = normalizeStoredCart([
      { productId: "print-1", quantity: 1, options: { size: "small" } },
      { productId: "print-1", quantity: 2, options: { size: "small" } },
      { productId: "print-1", quantity: 1, options: { size: "large" } },
    ]);

    expect(cart).toEqual([
      { productId: "print-1", quantity: 3, options: { size: "small" } },
      { productId: "print-1", quantity: 1, options: { size: "large" } },
    ]);
  });

  it("builds stable selection keys independent of object order", () => {
    expect(optionSelectionKey({ finish: "matte", size: "large" })).toBe(
      optionSelectionKey({ size: "large", finish: "matte" }),
    );
  });
});
