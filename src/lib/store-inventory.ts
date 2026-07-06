import type { ProductOption, ProductOptionValue, SelectedProductOption } from "@/src/lib/store-options";

export type InventoryStatus =
  | "not_tracked"
  | "in_stock"
  | "low_stock"
  | "backorder"
  | "sold_out";

export interface InventoryProductLike {
  inventoryTracked: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
}

export interface InventoryAvailability {
  status: InventoryStatus;
  available: boolean;
  label: string;
}

function stockStatus(input: InventoryProductLike): InventoryStatus {
  if (!input.inventoryTracked) return "not_tracked";
  if (input.stockQuantity <= 0) {
    return input.allowBackorder ? "backorder" : "sold_out";
  }
  if (input.lowStockThreshold > 0 && input.stockQuantity <= input.lowStockThreshold) {
    return "low_stock";
  }
  return "in_stock";
}

export function inventoryStatusLabel(status: InventoryStatus) {
  if (status === "not_tracked") return "Not tracked";
  if (status === "in_stock") return "In stock";
  if (status === "low_stock") return "Low stock";
  if (status === "backorder") return "Backorder";
  return "Sold out";
}

export function inventoryAvailable(input: InventoryProductLike): InventoryAvailability {
  const status = stockStatus(input);
  return {
    status,
    available: status !== "sold_out",
    label: inventoryStatusLabel(status),
  };
}

export function optionValueAvailable(value: ProductOptionValue) {
  return inventoryAvailable(value);
}

export function selectedOptionValues(
  options: ProductOption[],
  selectedOptions: SelectedProductOption[],
) {
  return selectedOptions.flatMap((selected) => {
    const option = options.find((item) => item.id === selected.optionId);
    const value = option?.values.find((item) => item.id === selected.valueId);
    return value ? [value] : [];
  });
}

export function productAvailableForSelection(
  product: InventoryProductLike & { options: ProductOption[] },
  selectedOptions: SelectedProductOption[],
) {
  const productStatus = inventoryAvailable(product);
  if (!productStatus.available) return productStatus;
  const unavailableValue = selectedOptionValues(product.options, selectedOptions).find(
    (value) => !optionValueAvailable(value).available,
  );
  if (unavailableValue) {
    return {
      status: "sold_out" as const,
      available: false,
      label: `${unavailableValue.label} sold out`,
    };
  }
  return productStatus;
}
