import { describe, it, expect } from "vitest";
import {
  contactNotification,
  galleryInvite,
  manualOrderAdminNotification,
  manualOrderCustomerConfirmation,
} from "@/src/email/templates";
import type { StoreOrderConfirmation } from "@/src/lib/store-order-confirmation";

const order: StoreOrderConfirmation = {
  orderId: "01TESTORDER",
  status: "pending",
  customerName: "Riley",
  customerEmail: "riley@example.com",
  subtotalCents: 13900,
  totalCents: 13900,
  currency: "USD",
  itemCount: 1,
  createdAt: "2026-07-05T19:00:00.000Z",
  receiptUrl: "/cart/confirmation?order=01TESTORDER",
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
      order,
      siteName: "Studio",
    });
    expect(msg.to).toBe("riley@example.com");
    expect(msg.subject).toContain("01TESTORDER");
    expect(msg.html).toContain("Fine Art Print");
    expect(msg.html).toContain("Size: 16 x 20");
    expect(msg.text ?? "").toContain("Total: $139.00");
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
