import { describe, it, expect } from "vitest";
import {
  contactNotification,
  galleryInvite,
  manualOrderAdminNotification,
  manualOrderCustomerConfirmation,
  storeRefundIssued,
  storeOrderDelivered,
  storeOrderReady,
  storeOrderShipped,
  storeInvoiceIssued,
  storeReceiptIssued,
} from "@/src/email/templates";
import type { AdminOrderDTO } from "@/src/db/queries/orders";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";

const statusUrl = "https://example.com/orders/status?token=signed-status";

const order: StoreOrderConfirmation = {
  orderId: "01TESTORDER",
  status: "pending",
  customerName: "Riley",
  customerEmail: "riley@example.com",
  subtotalCents: 13900,
  discountCents: 0,
  promoCode: null,
  taxCents: 1147,
  shippingCents: 1200,
  shippingProfileLabel: "Standard shipping",
  totalCents: 16247,
  currency: "USD",
  itemCount: 1,
  createdAt: "2026-07-05T19:00:00.000Z",
  receiptUrl: "/cart/confirmation?order=01TESTORDER",
  checkoutSettings: {
    checkoutLabel: "Manual invoice checkout",
    checkoutInstructions: "Submit your details.",
    confirmationMessage: "The studio will follow up with invoice details.",
    taxEnabled: true,
    taxRateBps: 825,
    shippingMode: "flat",
    shippingFlatCents: 1200,
    shippingProfiles: [],
  },
  lines: [
    {
      productId: "product-1",
      productSlug: "fine-art-print",
      productName: "Fine Art Print",
      sku: "PRINT-01",
      quantity: 1,
      unitPriceCents: 13900,
      lineTotalCents: 13900,
      selectedOptions: [
        {
          optionId: "size",
          optionName: "Size",
          valueId: "16x20",
          valueLabel: "16 x 20",
          priceDeltaCents: 4500,
        },
      ],
    },
  ],
};

const adminOrder: AdminOrderDTO = {
  id: order.orderId,
  clientId: "client-1",
  clientName: order.customerName,
  clientPhone: "555-0101",
  clientNotes: null,
  email: order.customerEmail,
  status: "invoiced",
  subtotalCents: order.subtotalCents,
  discountCents: order.discountCents,
  promoCode: order.promoCode,
  taxCents: order.taxCents,
  shippingCents: order.shippingCents,
  shippingProfileId: "default",
  shippingProfileLabel: order.shippingProfileLabel,
  totalCents: order.totalCents,
  currency: order.currency,
  paymentProvider: "manual",
  paymentRef: "Manual invoice requested",
  fulfillmentStatus: "unfulfilled",
  fulfillmentCarrier: null,
  fulfillmentTrackingNumber: null,
  fulfillmentTrackingUrl: null,
  fulfillmentReadyAt: null,
  fulfillmentShippedAt: null,
  fulfillmentDeliveredAt: null,
  fulfillmentNotes: null,
  packingChecklist: [],
  storeSettingsSnapshot: order.checkoutSettings,
  invoice: null,
  createdAt: order.createdAt,
  updatedAt: order.createdAt,
  refunds: [],
  items: [
    {
      id: "item-1",
      productId: "product-1",
      photoId: null,
      description: "Fine Art Print — Size: 16 x 20",
      stripeTaxCode: null,
      options: order.lines[0].selectedOptions,
      quantity: 1,
      unitPriceCents: 13900,
      lineTotalCents: 13900,
    },
  ],
};

describe("contactNotification", () => {
  it("includes name and message, sets replyTo and subject", () => {
    const msg = contactNotification({
      to: "admin@example.com",
      name: "Jane Doe",
      email: "jane@sender.com",
      subject: "Wedding inquiry",
      message: "Are you available in June?",
    });
    expect(msg.html).toContain("Jane Doe");
    expect(msg.html).toContain("Are you available in June?");
    expect(msg.replyTo).toBe("jane@sender.com");
    expect(msg.subject).toContain("Wedding inquiry");
  });

  it("escapes HTML in the name (raw <script> does not appear)", () => {
    const msg = contactNotification({
      to: "admin@example.com",
      name: "<script>alert(1)</script>",
      email: "x@y.com",
      message: "hi",
    });
    expect(msg.html).not.toContain("<script>");
  });
});

describe("galleryInvite", () => {
  it("includes the shareUrl and gallery title", () => {
    const msg = galleryInvite({
      to: "client@example.com",
      clientName: "Sam",
      galleryTitle: "Summer Shoot",
      shareUrl: "https://example.com/g/abc123",
    });
    expect(msg.html).toContain("Summer Shoot");
    expect(msg.html).toContain("https://example.com/g/abc123");
  });

  it("escapes HTML in the client name (raw <script> does not appear)", () => {
    const msg = galleryInvite({
      to: "client@example.com",
      clientName: "<script>alert(1)</script>",
      galleryTitle: "Gallery",
      shareUrl: "https://example.com/g/abc123",
    });
    expect(msg.html).not.toContain("<script>");
  });
});

describe("manual order email templates", () => {
  it("builds a customer confirmation with itemized options", () => {
    const msg = manualOrderCustomerConfirmation({
      to: "riley@example.com",
      order: { ...order, statusUrl },
      siteName: "Studio",
    });
    expect(msg.to).toBe("riley@example.com");
    expect(msg.subject).toContain("01TESTORDER");
    expect(msg.html).toContain("Fine Art Print");
    expect(msg.html).toContain("Size: 16 x 20");
    expect(msg.text ?? "").toContain("Tax: $11.47");
    expect(msg.text ?? "").toContain("Shipping (Standard shipping): $12.00");
    expect(msg.text ?? "").toContain("Total: $162.47");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain(statusUrl);
  });

  it("builds an admin notification with replyTo set to the customer", () => {
    const msg = manualOrderAdminNotification({
      to: "admin@example.com",
      order,
      adminUrl: "https://example.com/admin/store",
    });
    expect(msg.replyTo).toBe("riley@example.com");
    expect(msg.html).toContain("Review in Store admin");
    expect(msg.text ?? "").toContain("https://example.com/admin/store");
  });

  it("escapes customer and item text", () => {
    const msg = manualOrderCustomerConfirmation({
      to: "riley@example.com",
      siteName: "Studio",
      order: {
        ...order,
        customerName: "<script>alert(1)</script>",
        lines: [{ ...order.lines[0], productName: "<img src=x>" }],
      },
    });
    expect(msg.html).not.toContain("<script>");
    expect(msg.html).not.toContain("<img");
  });
});

describe("storeInvoiceIssued", () => {
  it("builds a client invoice email with secure link and totals", () => {
    const msg = storeInvoiceIssued({
      to: "riley@example.com",
      order: adminOrder,
      invoice: {
        id: "invoice-1",
        number: "INV-20260705-ABC123",
        status: "issued",
        amountCents: 16247,
        currency: "USD",
        notes: "Thank you.",
        paymentInstructions: "Pay by card after confirmation.",
        issuedAt: "2026-07-05T20:00:00.000Z",
        sentAt: "2026-07-05T20:00:00.000Z",
        dueAt: "2026-07-20T12:00:00.000Z",
        paidAt: null,
        paidAmountCents: null,
        paymentMethod: null,
        paymentReference: null,
        paymentNote: null,
        receiptSentAt: null,
        onlinePaymentProvider: null,
        onlinePaymentTaxMode: "fixed",
        onlinePaymentStatus: null,
        onlinePaymentSessionId: null,
        onlinePaymentIntentId: null,
        onlinePaymentUrl: null,
        onlinePaymentExpiresAt: null,
        createdAt: "2026-07-05T20:00:00.000Z",
        updatedAt: "2026-07-05T20:00:00.000Z",
      },
      invoiceUrl: "https://example.com/invoice/secret-token",
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("INV-20260705-ABC123");
    expect(msg.html).toContain("https://example.com/invoice/secret-token");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain("Pay by card after confirmation.");
    expect(msg.text ?? "").toContain(statusUrl);
    expect(msg.text ?? "").toContain("Total: $162.47");
  });
});

describe("storeReceiptIssued", () => {
  it("builds a paid receipt email with payment details", () => {
    const msg = storeReceiptIssued({
      to: "riley@example.com",
      order: { ...adminOrder, status: "paid" },
      invoice: {
        id: "invoice-1",
        number: "INV-20260705-ABC123",
        status: "paid",
        amountCents: 16247,
        currency: "USD",
        notes: null,
        paymentInstructions: "Pay by card after confirmation.",
        issuedAt: "2026-07-05T20:00:00.000Z",
        sentAt: "2026-07-05T20:00:00.000Z",
        dueAt: "2026-07-20T12:00:00.000Z",
        paidAt: "2026-07-10T18:00:00.000Z",
        paidAmountCents: 16247,
        paymentMethod: "Check",
        paymentReference: "1042",
        paymentNote: "Paid in full.",
        receiptSentAt: "2026-07-10T18:05:00.000Z",
        onlinePaymentProvider: null,
        onlinePaymentTaxMode: "fixed",
        onlinePaymentStatus: null,
        onlinePaymentSessionId: null,
        onlinePaymentIntentId: null,
        onlinePaymentUrl: null,
        onlinePaymentExpiresAt: null,
        createdAt: "2026-07-05T20:00:00.000Z",
        updatedAt: "2026-07-10T18:05:00.000Z",
      },
      receiptUrl: "https://example.com/invoice/signed-receipt",
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("Receipt");
    expect(msg.html).toContain("Amount paid: $162.47");
    expect(msg.html).toContain("Reference: 1042");
    expect(msg.text ?? "").toContain("Method: Check");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain(statusUrl);
    expect(msg.text ?? "").toContain("https://example.com/invoice/signed-receipt");
  });
});

describe("storeRefundIssued", () => {
  it("builds a refund email with amount and receipt link", () => {
    const msg = storeRefundIssued({
      to: "riley@example.com",
      order: { ...adminOrder, status: "paid" },
      refund: {
        id: "refund-1",
        orderId: adminOrder.id,
        invoiceId: "invoice-1",
        amountCents: 2500,
        currency: "USD",
        status: "succeeded",
        provider: "manual",
        providerRefundId: null,
        providerError: null,
        method: "Check",
        reference: "1099",
        reason: "Client change",
        note: "Refunded the extra print.",
        refundedAt: "2026-07-12T18:00:00.000Z",
        receiptSentAt: "2026-07-12T18:05:00.000Z",
        createdBy: "user-1",
        createdAt: "2026-07-12T18:00:00.000Z",
        updatedAt: "2026-07-12T18:05:00.000Z",
      },
      receiptUrl: "https://example.com/invoice/refund-receipt",
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("Refund");
    expect(msg.html).toContain("Amount refunded: $25.00");
    expect(msg.html).toContain("Reference: 1099");
    expect(msg.text ?? "").toContain("Refunded the extra print.");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain(statusUrl);
    expect(msg.text ?? "").toContain("https://example.com/invoice/refund-receipt");
  });
});

describe("store fulfillment emails", () => {
  it("builds a ready update with the customer status link even without a receipt", () => {
    const msg = storeOrderReady({
      to: "riley@example.com",
      order: {
        ...adminOrder,
        status: "paid",
        fulfillmentStatus: "ready",
        fulfillmentReadyAt: "2026-07-11T12:00:00.000Z",
      },
      receiptUrl: null,
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("is ready");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain(statusUrl);
    expect(msg.html).not.toContain("View receipt");
  });

  it("builds a shipped update with tracking details", () => {
    const msg = storeOrderShipped({
      to: "riley@example.com",
      order: {
        ...adminOrder,
        status: "paid",
        fulfillmentStatus: "shipped",
        fulfillmentCarrier: "USPS",
        fulfillmentTrackingNumber: "9400TEST",
        fulfillmentTrackingUrl: "https://tools.usps.com/go/TrackConfirmAction",
        fulfillmentReadyAt: "2026-07-11T12:00:00.000Z",
        fulfillmentShippedAt: "2026-07-12T12:00:00.000Z",
      },
      receiptUrl: "https://example.com/invoice/signed-receipt",
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("has shipped");
    expect(msg.html).toContain("Carrier: USPS");
    expect(msg.html).toContain("9400TEST");
    expect(msg.html).toContain("Track shipment");
    expect(msg.html).toContain("Track order status");
    expect(msg.text ?? "").toContain(statusUrl);
    expect(msg.text ?? "").toContain(
      "View receipt: https://example.com/invoice/signed-receipt",
    );
  });

  it("builds a delivered update without exposing internal notes", () => {
    const msg = storeOrderDelivered({
      to: "riley@example.com",
      order: {
        ...adminOrder,
        status: "fulfilled",
        fulfillmentStatus: "delivered",
        fulfillmentCarrier: "UPS",
        fulfillmentTrackingNumber: "1ZTEST",
        fulfillmentDeliveredAt: "2026-07-15T12:00:00.000Z",
        fulfillmentNotes: "Internal packing and client preference notes.",
      },
      receiptUrl: "https://example.com/invoice/signed-receipt",
      statusUrl,
      siteName: "Studio",
    });
    expect(msg.subject).toContain("was delivered");
    expect(msg.html).toContain("Carrier: UPS");
    expect(msg.html).toContain("1ZTEST");
    expect(msg.html).not.toContain("Internal packing");
    expect(msg.text ?? "").not.toContain("Internal packing");
  });
});
