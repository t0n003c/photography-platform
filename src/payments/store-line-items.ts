import type { AdminOrderDTO } from "@/src/db/queries/orders";
import type { CartSummaryDTO } from "@/src/db/queries/store";
import type { CheckoutLineItem } from "@/src/payments/provider";

function cleanDescription(value: string | null | undefined, fallback: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

function appendAdjustmentLines(
  lines: CheckoutLineItem[],
  input: { taxCents: number; shippingCents: number; shippingTaxCode?: string | null },
) {
  if (input.taxCents > 0) {
    lines.push({
      description: "Tax",
      amountCents: input.taxCents,
      quantity: 1,
    });
  }
  if (input.shippingCents > 0) {
    lines.push({
      description: "Shipping",
      amountCents: input.shippingCents,
      quantity: 1,
      taxCode: input.shippingTaxCode ?? null,
    });
  }
}

export function checkoutLineItemsFromCartSummary(
  summary: CartSummaryDTO,
): CheckoutLineItem[] {
  const lines = summary.lines.map((line) => ({
    description: cleanDescription(line.product.name, "Product"),
    amountCents: line.unitPriceCents,
    quantity: line.quantity,
    taxCode: line.product.stripeTaxCode,
  }));
  appendAdjustmentLines(lines, {
    ...summary,
    shippingTaxCode: summary.payment.shippingTaxCode,
  });
  return lines;
}

export function checkoutLineItemsFromOrder(order: AdminOrderDTO): CheckoutLineItem[] {
  const lines = order.items.map((item) => ({
    description: cleanDescription(item.description?.split(" — ")[0], "Product"),
    amountCents: item.unitPriceCents,
    quantity: item.quantity,
    taxCode: item.stripeTaxCode,
  }));
  appendAdjustmentLines(lines, order);
  return lines;
}

export function checkoutLineItemsTotal(lines: CheckoutLineItem[]) {
  return lines.reduce((sum, line) => sum + line.amountCents * line.quantity, 0);
}
