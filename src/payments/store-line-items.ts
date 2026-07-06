import type { AdminOrderDTO } from "@/src/db/queries/orders";
import type { CartSummaryDTO } from "@/src/db/queries/store";
import type { CheckoutLineItem } from "@/src/payments/provider";

function cleanDescription(value: string | null | undefined, fallback: string) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : fallback;
}

function appendAdjustmentLines(
  lines: CheckoutLineItem[],
  input: {
    taxCents: number;
    shippingCents: number;
    shippingTaxCode?: string | null;
  },
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

function prorateDiscount(
  lineTotals: number[],
  discountCents: number,
): number[] {
  const subtotal = lineTotals.reduce((sum, value) => sum + value, 0);
  const discount = Math.min(Math.max(Math.round(discountCents), 0), subtotal);
  if (subtotal <= 0 || discount <= 0) return lineTotals;

  let remainingDiscount = discount;
  return lineTotals.map((lineTotal, index) => {
    const lineDiscount =
      index === lineTotals.length - 1
        ? remainingDiscount
        : Math.min(
            lineTotal,
            Math.round((discount * lineTotal) / Math.max(subtotal, 1)),
          );
    remainingDiscount -= lineDiscount;
    return Math.max(0, lineTotal - lineDiscount);
  });
}

export function checkoutLineItemsFromCartSummary(
  summary: CartSummaryDTO,
): CheckoutLineItem[] {
  const discountedTotals = prorateDiscount(
    summary.lines.map((line) => line.lineTotalCents),
    summary.discountCents,
  );
  const lines = summary.lines.map((line, index) => {
    if (summary.discountCents > 0) {
      return {
        description: `${cleanDescription(line.product.name, "Product")} × ${line.quantity}`,
        amountCents: discountedTotals[index] ?? line.lineTotalCents,
        quantity: 1,
        taxCode: line.product.stripeTaxCode,
      };
    }
    return {
      description: cleanDescription(line.product.name, "Product"),
      amountCents: line.unitPriceCents,
      quantity: line.quantity,
      taxCode: line.product.stripeTaxCode,
    };
  });
  appendAdjustmentLines(lines, {
    ...summary,
    shippingTaxCode: summary.payment.shippingTaxCode,
  });
  return lines;
}

export function checkoutLineItemsFromOrder(order: AdminOrderDTO): CheckoutLineItem[] {
  const discountedTotals = prorateDiscount(
    order.items.map((item) => item.lineTotalCents),
    order.discountCents,
  );
  const lines = order.items.map((item, index) => {
    const description = cleanDescription(item.description?.split(" — ")[0], "Product");
    if (order.discountCents > 0) {
      return {
        description: `${description} × ${item.quantity}`,
        amountCents: discountedTotals[index] ?? item.lineTotalCents,
        quantity: 1,
        taxCode: item.stripeTaxCode,
      };
    }
    return {
      description,
      amountCents: item.unitPriceCents,
      quantity: item.quantity,
      taxCode: item.stripeTaxCode,
    };
  });
  appendAdjustmentLines(lines, order);
  return lines;
}

export function checkoutLineItemsTotal(lines: CheckoutLineItem[]) {
  return lines.reduce((sum, line) => sum + line.amountCents * line.quantity, 0);
}
