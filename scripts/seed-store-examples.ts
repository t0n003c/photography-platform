import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { asc, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/src/db/client";
import { ensureMenusSeeded, invalidateMenu } from "@/src/db/queries/menus";
import { invalidateSiteSettings } from "@/src/db/queries/settings";
import {
  client,
  invoice,
  menu,
  menuItem,
  order as orderTable,
  orderItem,
  orderRefund,
  page,
  photo,
  product,
  siteSettings,
} from "@/src/db/schema";
import type { ProductOption, SelectedProductOption } from "@/src/lib/store-options";
import {
  calculateStoreTotals,
  normalizeStoreCheckoutSettings,
  publicStoreCheckoutSettings,
  type PublicStoreCheckoutSettings,
} from "@/src/lib/store-settings";

function envFileValue(key: string) {
  if (!existsSync(".env")) return null;
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return null;
  const raw = line.slice(line.indexOf("=") + 1).trim();
  return raw.replace(/^['"]|['"]$/g, "") || null;
}

const BASE_URL =
  process.env.APP_BASE_URL ?? envFileValue("APP_BASE_URL") ?? "http://localhost:3001";
const AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ??
  envFileValue("BETTER_AUTH_SECRET") ??
  "dev-insecure-secret-change-me";
const SHOP_PAGE_ID = "store-example-page-shop";
const SHOP_MENU_ITEM_ID = "store-example-menu-shop";
const APPLY_SETTINGS = !process.argv.includes("--no-settings");
const ALLOW_PRODUCTION = process.env.STORE_EXAMPLES_ALLOW_PRODUCTION === "1";

const productIds = [
  "store-example-product-fine-art-print",
  "store-example-product-framed-print",
  "store-example-product-low-stock",
  "store-example-product-sold-out",
  "store-example-product-backorder-canvas",
  "store-example-product-digital-download",
  "store-example-product-bundle",
] as const;

const clientIds = [
  "store-example-client-pending",
  "store-example-client-invoiced",
  "store-example-client-paid",
  "store-example-client-shipped",
  "store-example-client-refunded",
  "store-example-client-expired",
] as const;

const orderIds = [
  "store-example-order-pending",
  "store-example-order-invoiced",
  "store-example-order-paid",
  "store-example-order-shipped",
  "store-example-order-refunded",
  "store-example-order-expired-link",
] as const;

const invoiceIds = [
  "store-example-invoice-invoiced",
  "store-example-invoice-paid",
  "store-example-invoice-shipped",
  "store-example-invoice-refunded",
  "store-example-invoice-expired",
] as const;

const optionSets: Record<string, ProductOption[]> = {
  print: [
    {
      id: "size",
      name: "Size",
      required: true,
      values: [
        {
          id: "8x10",
          label: "8 x 10",
          priceDeltaCents: 0,
          inventoryTracked: true,
          stockQuantity: 8,
          lowStockThreshold: 2,
          allowBackorder: false,
        },
        {
          id: "11x14",
          label: "11 x 14",
          priceDeltaCents: 3000,
          inventoryTracked: true,
          stockQuantity: 3,
          lowStockThreshold: 2,
          allowBackorder: false,
        },
        {
          id: "16x20",
          label: "16 x 20",
          priceDeltaCents: 7000,
          inventoryTracked: true,
          stockQuantity: 0,
          lowStockThreshold: 1,
          allowBackorder: true,
        },
      ],
    },
    {
      id: "finish",
      name: "Finish",
      required: true,
      values: [
        {
          id: "matte",
          label: "Matte",
          priceDeltaCents: 0,
          inventoryTracked: false,
          stockQuantity: 0,
          lowStockThreshold: 0,
          allowBackorder: false,
        },
        {
          id: "gloss",
          label: "Gloss",
          priceDeltaCents: 800,
          inventoryTracked: false,
          stockQuantity: 0,
          lowStockThreshold: 0,
          allowBackorder: false,
        },
      ],
    },
  ],
  bundle: [
    {
      id: "package",
      name: "Package",
      required: true,
      values: [
        {
          id: "mini",
          label: "Mini set",
          priceDeltaCents: 0,
          inventoryTracked: true,
          stockQuantity: 4,
          lowStockThreshold: 2,
          allowBackorder: false,
        },
        {
          id: "full",
          label: "Full set",
          priceDeltaCents: 12500,
          inventoryTracked: true,
          stockQuantity: 2,
          lowStockThreshold: 1,
          allowBackorder: false,
        },
      ],
    },
  ],
};

const checkoutSettings = normalizeStoreCheckoutSettings({
  notifyEmail: null,
  checkoutLabel: "Manual invoice checkout",
  checkoutInstructions:
    "Choose a shipping option, add any promo code, and submit the request. The studio will review the order and send an invoice or receipt.",
  confirmationMessage:
    "Thanks - your example order request is saved. Use the status link to review invoices, receipts, fulfillment, and refunds.",
  taxEnabled: true,
  taxRateBps: 950,
  shippingMode: "flat",
  shippingFlatCents: 995,
  shippingProfiles: [
    {
      id: "pickup",
      label: "Studio pickup",
      mode: "pickup",
      amountCents: 0,
      freeThresholdCents: 0,
      enabled: true,
    },
    {
      id: "standard",
      label: "Standard print shipping",
      mode: "flat",
      amountCents: 995,
      freeThresholdCents: 15000,
      enabled: true,
    },
    {
      id: "express",
      label: "Express insured shipping",
      mode: "flat",
      amountCents: 2495,
      freeThresholdCents: 35000,
      enabled: true,
    },
  ],
  promoCodes: [
    {
      id: "welcome10",
      code: "WELCOME10",
      label: "Welcome 10% off",
      active: true,
      discountType: "percent",
      amountCents: 0,
      percentBps: 1000,
      minimumSubtotalCents: 0,
      usageLimit: null,
      expiresAt: null,
    },
    {
      id: "print25",
      code: "PRINT25",
      label: "$25 off print orders over $150",
      active: true,
      discountType: "fixed",
      amountCents: 2500,
      percentBps: 0,
      minimumSubtotalCents: 15000,
      usageLimit: null,
      expiresAt: null,
    },
  ],
});

type ProductSeed = {
  id: (typeof productIds)[number];
  slug: string;
  sku: string;
  name: string;
  description: string;
  kind: "print" | "digital" | "bundle";
  basePriceCents: number;
  salePriceCents: number | null;
  category: string;
  stripeTaxCode: string;
  inventoryTracked: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  tags: string[];
  options: ProductOption[];
  isFeatured: boolean;
  sortOrder: number;
  photoId?: string | null;
};

type LineSeed = {
  productId: (typeof productIds)[number];
  quantity: number;
  selectedOptions?: SelectedProductOption[];
};

type OrderSeed = {
  id: (typeof orderIds)[number];
  clientId: (typeof clientIds)[number];
  clientName: string;
  email: string;
  phone: string;
  status: "pending" | "invoiced" | "paid" | "fulfilled";
  fulfillmentStatus:
    | "unfulfilled"
    | "in_progress"
    | "ready"
    | "shipped"
    | "delivered";
  shippingProfileId: "pickup" | "standard" | "express";
  promoCode?: string | null;
  paymentProvider: "manual" | "stripe";
  paymentRef: string;
  lines: LineSeed[];
  invoice?: {
    id: (typeof invoiceIds)[number];
    number: string;
    status: "issued" | "paid";
    notes: string;
    paymentInstructions: string;
    dueInDays?: number;
    paidDaysAgo?: number;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    receiptSent?: boolean;
    online?: {
      status: "pending" | "expired" | "paid";
      sessionId: string;
      paymentIntentId?: string | null;
      url?: string | null;
      expiresInDays?: number;
    };
  };
  fulfillment?: {
    carrier?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    readyDaysAgo?: number;
    shippedDaysAgo?: number;
    deliveredDaysAgo?: number;
    notes?: string | null;
  };
  refund?: {
    id: string;
    amountCents: number;
    status: "pending" | "succeeded";
    provider: "manual" | "stripe";
    method: string;
    reference: string;
    reason: string;
    note: string;
  };
  packingChecked?: number[];
};

function dateOffset(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function optionLabel(options: SelectedProductOption[]) {
  if (options.length === 0) return "";
  return ` - ${options
    .map((option) => `${option.optionName}: ${option.valueLabel}`)
    .join(", ")}`;
}

function selectedPrint(size: "8x10" | "11x14" | "16x20", finish: "matte" | "gloss") {
  const sizeValue = optionSets.print[0]!.values.find((item) => item.id === size)!;
  const finishValue = optionSets.print[1]!.values.find((item) => item.id === finish)!;
  return [
    {
      optionId: "size",
      optionName: "Size",
      valueId: sizeValue.id,
      valueLabel: sizeValue.label,
      priceDeltaCents: sizeValue.priceDeltaCents,
    },
    {
      optionId: "finish",
      optionName: "Finish",
      valueId: finishValue.id,
      valueLabel: finishValue.label,
      priceDeltaCents: finishValue.priceDeltaCents,
    },
  ];
}

function selectedBundle(valueId: "mini" | "full") {
  const value = optionSets.bundle[0]!.values.find((item) => item.id === valueId)!;
  return [
    {
      optionId: "package",
      optionName: "Package",
      valueId: value.id,
      valueLabel: value.label,
      priceDeltaCents: value.priceDeltaCents,
    },
  ];
}

function currentPrice(row: ProductSeed) {
  return row.salePriceCents !== null && row.salePriceCents < row.basePriceCents
    ? row.salePriceCents
    : row.basePriceCents;
}

function lineUnitPrice(row: ProductSeed, selectedOptions: SelectedProductOption[]) {
  return (
    currentPrice(row) +
    selectedOptions.reduce((sum, option) => sum + option.priceDeltaCents, 0)
  );
}

function orderStatusLink(orderId: string) {
  return `${BASE_URL}/orders/status?token=${encodeURIComponent(signToken("ord", orderId))}`;
}

function invoiceLink(invoiceId: string) {
  return `${BASE_URL}/invoice/${encodeURIComponent(signToken("inv", invoiceId))}`;
}

function signToken(prefix: "inv" | "ord", id: string) {
  const payload = `${prefix}.${id}`;
  const sig = createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

async function cleanup() {
  await db.delete(orderTable).where(inArray(orderTable.id, [...orderIds]));
  await db
    .delete(client)
    .where(
      or(
        inArray(client.id, [...clientIds]),
        inArray(
          client.email,
          clientIds.map((id) => `${id.replace("store-example-client-", "store-example-")}@example.test`),
        ),
      ),
    );
  await db.delete(product).where(inArray(product.id, [...productIds]));
  await db.delete(menuItem).where(eq(menuItem.id, SHOP_MENU_ITEM_ID));
}

async function applyStoreSettings() {
  if (!APPLY_SETTINGS) {
    console.log("[store-examples] skipped demo store settings (--no-settings)");
    return;
  }
  if (process.env.NODE_ENV === "production" && !ALLOW_PRODUCTION) {
    console.log(
      "[store-examples] skipped settings in production; set STORE_EXAMPLES_ALLOW_PRODUCTION=1 to override",
    );
    return;
  }

  await db
    .insert(siteSettings)
    .values({
      id: "site",
      storeCheckoutLabel: checkoutSettings.checkoutLabel,
      storeCheckoutInstructions: checkoutSettings.checkoutInstructions,
      storeConfirmationMessage: checkoutSettings.confirmationMessage,
      storeTaxEnabled: checkoutSettings.taxEnabled,
      storeTaxRateBps: checkoutSettings.taxRateBps,
      storeShippingMode: checkoutSettings.shippingMode,
      storeShippingFlatCents: checkoutSettings.shippingFlatCents,
      storeShippingProfiles: checkoutSettings.shippingProfiles,
      storePromoCodes: checkoutSettings.promoCodes,
    })
    .onConflictDoUpdate({
      target: siteSettings.id,
      set: {
        storeCheckoutLabel: checkoutSettings.checkoutLabel,
        storeCheckoutInstructions: checkoutSettings.checkoutInstructions,
        storeConfirmationMessage: checkoutSettings.confirmationMessage,
        storeTaxEnabled: checkoutSettings.taxEnabled,
        storeTaxRateBps: checkoutSettings.taxRateBps,
        storeShippingMode: checkoutSettings.shippingMode,
        storeShippingFlatCents: checkoutSettings.shippingFlatCents,
        storeShippingProfiles: checkoutSettings.shippingProfiles,
        storePromoCodes: checkoutSettings.promoCodes,
      },
    });
  await invalidateSiteSettings();
  console.log("[store-examples] applied demo tax, shipping, and promo settings");
}

async function seedProducts(photoIds: string[]) {
  const products: ProductSeed[] = [
    {
      id: "store-example-product-fine-art-print",
      slug: "store-example-fine-art-print",
      sku: "STORE-EX-FINE-ART",
      name: "Example Fine Art Print",
      description:
        "Option-driven print used to test size, finish, option price deltas, and option inventory.",
      kind: "print",
      basePriceCents: 6500,
      salePriceCents: null,
      category: "Prints",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
      allowBackorder: false,
      tags: ["example", "print", "options", "inventory"],
      options: optionSets.print,
      isFeatured: true,
      sortOrder: 9000,
      photoId: photoIds[0] ?? null,
    },
    {
      id: "store-example-product-framed-print",
      slug: "store-example-framed-print-sale",
      sku: "STORE-EX-FRAMED",
      name: "Example Framed Print - Sale",
      description:
        "Sale product used to test sale badges, sale prices, cart pricing, and tax export line items.",
      kind: "print",
      basePriceCents: 18500,
      salePriceCents: 14500,
      category: "Prints",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: true,
      stockQuantity: 6,
      lowStockThreshold: 3,
      allowBackorder: false,
      tags: ["example", "sale", "framed", "print"],
      options: [],
      isFeatured: true,
      sortOrder: 9001,
      photoId: photoIds[1] ?? null,
    },
    {
      id: "store-example-product-low-stock",
      slug: "store-example-low-stock-postcard-set",
      sku: "STORE-EX-LOW",
      name: "Example Low-Stock Postcard Set",
      description:
        "Low-stock product used to test inventory filters and public stock labels.",
      kind: "print",
      basePriceCents: 3200,
      salePriceCents: null,
      category: "Cards",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: true,
      stockQuantity: 2,
      lowStockThreshold: 5,
      allowBackorder: false,
      tags: ["example", "low stock", "cards"],
      options: [],
      isFeatured: false,
      sortOrder: 9002,
      photoId: photoIds[2] ?? null,
    },
    {
      id: "store-example-product-sold-out",
      slug: "store-example-sold-out-calendar",
      sku: "STORE-EX-SOLD",
      name: "Example Sold-Out Calendar",
      description:
        "Sold-out product used to test disabled add-to-cart controls and checkout blocking.",
      kind: "print",
      basePriceCents: 4800,
      salePriceCents: null,
      category: "Seasonal",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: true,
      stockQuantity: 0,
      lowStockThreshold: 3,
      allowBackorder: false,
      tags: ["example", "sold out", "calendar"],
      options: [],
      isFeatured: false,
      sortOrder: 9003,
      photoId: photoIds[3] ?? null,
    },
    {
      id: "store-example-product-backorder-canvas",
      slug: "store-example-backorder-canvas",
      sku: "STORE-EX-BACKORDER",
      name: "Example Backorder Canvas",
      description:
        "Backorder product used to test available-but-out-of-stock inventory handling.",
      kind: "print",
      basePriceCents: 22500,
      salePriceCents: null,
      category: "Canvas",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: true,
      stockQuantity: 0,
      lowStockThreshold: 2,
      allowBackorder: true,
      tags: ["example", "backorder", "canvas"],
      options: [],
      isFeatured: true,
      sortOrder: 9004,
      photoId: photoIds[4] ?? null,
    },
    {
      id: "store-example-product-digital-download",
      slug: "store-example-digital-download",
      sku: "STORE-EX-DIGITAL",
      name: "Example Digital Download",
      description:
        "Digital product used to test non-shipped cart lines and non-inventory products.",
      kind: "digital",
      basePriceCents: 2900,
      salePriceCents: null,
      category: "Digital",
      stripeTaxCode: "txcd_10000000",
      inventoryTracked: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
      allowBackorder: false,
      tags: ["example", "digital", "download"],
      options: [],
      isFeatured: false,
      sortOrder: 9005,
      photoId: photoIds[5] ?? null,
    },
    {
      id: "store-example-product-bundle",
      slug: "store-example-print-bundle",
      sku: "STORE-EX-BUNDLE",
      name: "Example Print Bundle",
      description:
        "Bundle product used to test package options, higher order totals, and free-shipping thresholds.",
      kind: "bundle",
      basePriceCents: 16000,
      salePriceCents: null,
      category: "Bundles",
      stripeTaxCode: "txcd_99999999",
      inventoryTracked: false,
      stockQuantity: 0,
      lowStockThreshold: 0,
      allowBackorder: false,
      tags: ["example", "bundle", "gift"],
      options: optionSets.bundle,
      isFeatured: true,
      sortOrder: 9006,
      photoId: photoIds[6] ?? null,
    },
  ];

  await db.insert(product).values(
    products.map((row) => ({
      id: row.id,
      slug: row.slug,
      sku: row.sku,
      name: row.name,
      description: row.description,
      kind: row.kind,
      photoId: row.photoId ?? null,
      basePriceCents: row.basePriceCents,
      salePriceCents: row.salePriceCents,
      currency: "USD",
      category: row.category,
      stripeTaxCode: row.stripeTaxCode,
      inventoryTracked: row.inventoryTracked,
      stockQuantity: row.stockQuantity,
      lowStockThreshold: row.lowStockThreshold,
      allowBackorder: row.allowBackorder,
      tags: row.tags,
      options: row.options,
      isFeatured: row.isFeatured,
      isActive: true,
      sortOrder: row.sortOrder,
    })),
  );

  return products;
}

function buildOrderRows(
  seed: OrderSeed,
  products: Map<string, ProductSeed>,
  snapshot: PublicStoreCheckoutSettings,
) {
  const items = seed.lines.map((line, index) => {
    const row = products.get(line.productId);
    if (!row) throw new Error(`Missing product ${line.productId}`);
    const selectedOptions = line.selectedOptions ?? [];
    const unitPriceCents = lineUnitPrice(row, selectedOptions);
    return {
      id: `${seed.id}-item-${index + 1}`,
      orderId: seed.id,
      productId: row.id,
      photoId: row.photoId ?? null,
      description: `${row.name}${optionLabel(selectedOptions)}`,
      stripeTaxCode: row.stripeTaxCode,
      options: selectedOptions,
      quantity: line.quantity,
      unitPriceCents,
      lineTotalCents: unitPriceCents * line.quantity,
    };
  });
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const totals = calculateStoreTotals(subtotalCents, checkoutSettings, {
    shippingProfileId: seed.shippingProfileId,
    promoCode: seed.promoCode,
  });
  const now = new Date();
  const readyAt = seed.fulfillment?.readyDaysAgo
    ? dateOffset(-seed.fulfillment.readyDaysAgo)
    : null;
  const shippedAt = seed.fulfillment?.shippedDaysAgo
    ? dateOffset(-seed.fulfillment.shippedDaysAgo)
    : null;
  const deliveredAt = seed.fulfillment?.deliveredDaysAgo
    ? dateOffset(-seed.fulfillment.deliveredDaysAgo)
    : null;

  return {
    order: {
      id: seed.id,
      clientId: seed.clientId,
      email: seed.email,
      status: seed.status,
      subtotalCents,
      discountCents: totals.discountCents,
      promoCode: totals.promo?.code ?? null,
      taxCents: totals.taxCents,
      shippingCents: totals.shippingCents,
      shippingProfileId: totals.shippingProfile.id,
      shippingProfileLabel: totals.shippingProfile.label,
      totalCents: totals.totalCents,
      currency: "USD",
      paymentProvider: seed.paymentProvider,
      paymentRef: seed.paymentRef,
      fulfillmentStatus: seed.fulfillmentStatus,
      fulfillmentCarrier: seed.fulfillment?.carrier ?? null,
      fulfillmentTrackingNumber: seed.fulfillment?.trackingNumber ?? null,
      fulfillmentTrackingUrl: seed.fulfillment?.trackingUrl ?? null,
      fulfillmentReadyAt: readyAt,
      fulfillmentShippedAt: shippedAt,
      fulfillmentDeliveredAt: deliveredAt,
      fulfillmentNotes: seed.fulfillment?.notes ?? null,
      packingChecklist: items.map((item, index) => {
        const checked = seed.packingChecked?.includes(index) ?? false;
        return {
          itemId: item.id,
          checked,
          checkedAt: checked ? now.toISOString() : null,
          checkedBy: null,
        };
      }),
      storeSettingsSnapshot: snapshot,
      createdAt: dateOffset(-7),
      updatedAt: now,
    },
    items,
    totals,
  };
}

async function seedOrders(products: ProductSeed[]) {
  const productMap = new Map(products.map((row) => [row.id, row]));
  const snapshot = publicStoreCheckoutSettings(checkoutSettings);
  const seeds: OrderSeed[] = [
    {
      id: "store-example-order-pending",
      clientId: "store-example-client-pending",
      clientName: "Example Pending Customer",
      email: "store-example-pending@example.test",
      phone: "555-0101",
      status: "pending",
      fulfillmentStatus: "unfulfilled",
      shippingProfileId: "standard",
      promoCode: "WELCOME10",
      paymentProvider: "manual",
      paymentRef: "Manual invoice requested",
      lines: [
        {
          productId: "store-example-product-fine-art-print",
          quantity: 1,
          selectedOptions: selectedPrint("11x14", "matte"),
        },
        { productId: "store-example-product-digital-download", quantity: 1 },
      ],
      packingChecked: [],
    },
    {
      id: "store-example-order-invoiced",
      clientId: "store-example-client-invoiced",
      clientName: "Example Awaiting Payment",
      email: "store-example-invoiced@example.test",
      phone: "555-0102",
      status: "invoiced",
      fulfillmentStatus: "unfulfilled",
      shippingProfileId: "express",
      promoCode: null,
      paymentProvider: "manual",
      paymentRef: "Invoice sent",
      lines: [
        {
          productId: "store-example-product-bundle",
          quantity: 1,
          selectedOptions: selectedBundle("full"),
        },
      ],
      invoice: {
        id: "store-example-invoice-invoiced",
        number: "INV-EXAMPLE-1001",
        status: "issued",
        notes: "Example issued invoice. Use this to test unpaid invoice display.",
        paymentInstructions: "Pay by check, Zelle, or studio-approved card link.",
        dueInDays: 14,
      },
      packingChecked: [],
    },
    {
      id: "store-example-order-paid",
      clientId: "store-example-client-paid",
      clientName: "Example Paid Customer",
      email: "store-example-paid@example.test",
      phone: "555-0103",
      status: "paid",
      fulfillmentStatus: "in_progress",
      shippingProfileId: "pickup",
      promoCode: "PRINT25",
      paymentProvider: "manual",
      paymentRef: "Cash receipt EX-PAID",
      lines: [
        { productId: "store-example-product-framed-print", quantity: 1 },
        { productId: "store-example-product-low-stock", quantity: 1 },
      ],
      invoice: {
        id: "store-example-invoice-paid",
        number: "INV-EXAMPLE-1002",
        status: "paid",
        notes: "Example paid invoice. Use this to test receipt rendering.",
        paymentInstructions: "Paid in full.",
        paidDaysAgo: 2,
        paymentMethod: "Cash",
        paymentReference: "CASH-EX-1002",
        receiptSent: true,
      },
      fulfillment: {
        readyDaysAgo: 1,
        notes: "Example internal prep note. It should not show on public pages.",
      },
      packingChecked: [0],
    },
    {
      id: "store-example-order-shipped",
      clientId: "store-example-client-shipped",
      clientName: "Example Shipped Customer",
      email: "store-example-shipped@example.test",
      phone: "555-0104",
      status: "paid",
      fulfillmentStatus: "shipped",
      shippingProfileId: "standard",
      promoCode: null,
      paymentProvider: "manual",
      paymentRef: "Card receipt EX-SHIP",
      lines: [
        {
          productId: "store-example-product-fine-art-print",
          quantity: 1,
          selectedOptions: selectedPrint("8x10", "gloss"),
        },
        { productId: "store-example-product-backorder-canvas", quantity: 1 },
      ],
      invoice: {
        id: "store-example-invoice-shipped",
        number: "INV-EXAMPLE-1003",
        status: "paid",
        notes: "Example shipped receipt with tracking.",
        paymentInstructions: "Paid in full.",
        paidDaysAgo: 3,
        paymentMethod: "Card",
        paymentReference: "CARD-EX-1003",
        receiptSent: true,
      },
      fulfillment: {
        carrier: "USPS",
        trackingNumber: "9400EXAMPLE",
        trackingUrl: "https://tracking.example/9400EXAMPLE",
        readyDaysAgo: 2,
        shippedDaysAgo: 1,
        notes: "Packed with corner protectors.",
      },
      packingChecked: [0, 1],
    },
    {
      id: "store-example-order-refunded",
      clientId: "store-example-client-refunded",
      clientName: "Example Refund Customer",
      email: "store-example-refunded@example.test",
      phone: "555-0105",
      status: "fulfilled",
      fulfillmentStatus: "delivered",
      shippingProfileId: "standard",
      promoCode: "WELCOME10",
      paymentProvider: "manual",
      paymentRef: "Card receipt EX-REFUND",
      lines: [
        { productId: "store-example-product-framed-print", quantity: 1 },
        { productId: "store-example-product-digital-download", quantity: 2 },
      ],
      invoice: {
        id: "store-example-invoice-refunded",
        number: "INV-EXAMPLE-1004",
        status: "paid",
        notes: "Example receipt with partial refund history.",
        paymentInstructions: "Paid in full.",
        paidDaysAgo: 8,
        paymentMethod: "Card",
        paymentReference: "CARD-EX-1004",
        receiptSent: true,
      },
      fulfillment: {
        carrier: "UPS",
        trackingNumber: "1ZEXAMPLE",
        trackingUrl: "https://tracking.example/1ZEXAMPLE",
        readyDaysAgo: 7,
        shippedDaysAgo: 6,
        deliveredDaysAgo: 4,
        notes: "Delivered to front desk.",
      },
      refund: {
        id: "store-example-refund-partial",
        amountCents: 2500,
        status: "succeeded",
        provider: "manual",
        method: "Card adjustment",
        reference: "REF-EX-1004",
        reason: "Goodwill adjustment",
        note: "Example partial refund for tax/export testing.",
      },
      packingChecked: [0, 1],
    },
    {
      id: "store-example-order-expired-link",
      clientId: "store-example-client-expired",
      clientName: "Example Expired Stripe Link",
      email: "store-example-expired@example.test",
      phone: "555-0106",
      status: "invoiced",
      fulfillmentStatus: "unfulfilled",
      shippingProfileId: "express",
      promoCode: null,
      paymentProvider: "stripe",
      paymentRef: "cs_test_store_example_expired",
      lines: [{ productId: "store-example-product-backorder-canvas", quantity: 1 }],
      invoice: {
        id: "store-example-invoice-expired",
        number: "INV-EXAMPLE-1005",
        status: "issued",
        notes:
          "Example issued invoice with an expired hosted checkout link. No real Stripe charge exists.",
        paymentInstructions: "Refresh the hosted payment link from Admin when Stripe is configured.",
        dueInDays: 7,
        online: {
          status: "expired",
          sessionId: "cs_test_store_example_expired",
          paymentIntentId: "pi_store_example_expired",
          url: "https://checkout.stripe.com/c/pay/cs_test_store_example_expired",
          expiresInDays: -1,
        },
      },
      packingChecked: [],
    },
  ];

  await db.insert(client).values(
    seeds.map((seed) => ({
      id: seed.clientId,
      name: seed.clientName,
      email: seed.email,
      phone: seed.phone,
      notes: "Seeded store example customer. Safe to delete with the store examples.",
    })),
  );

  const inserted: Array<{
    id: string;
    statusUrl: string;
    invoiceUrl: string | null;
    total: string;
    state: string;
  }> = [];

  for (const seed of seeds) {
    const built = buildOrderRows(seed, productMap, snapshot);
    await db.insert(orderTable).values(built.order);
    await db.insert(orderItem).values(built.items);

    if (seed.invoice) {
      const now = new Date();
      const invoiceCreated = dateOffset(-6);
      const issuedAt = dateOffset(-5);
      const paidAt =
        seed.invoice.status === "paid" ? dateOffset(-(seed.invoice.paidDaysAgo ?? 1)) : null;
      await db.insert(invoice).values({
        id: seed.invoice.id,
        orderId: seed.id,
        number: seed.invoice.number,
        status: seed.invoice.status,
        amountCents: built.order.totalCents,
        currency: "USD",
        notes: seed.invoice.notes,
        paymentInstructions: seed.invoice.paymentInstructions,
        issuedAt,
        sentAt: issuedAt,
        dueAt: seed.invoice.dueInDays ? dateOffset(seed.invoice.dueInDays) : null,
        paidAt,
        paidAmountCents: paidAt ? built.order.totalCents : null,
        paymentMethod: seed.invoice.paymentMethod ?? null,
        paymentReference: seed.invoice.paymentReference ?? null,
        paymentNote: seed.invoice.status === "paid" ? "Seeded example payment." : null,
        receiptSentAt: seed.invoice.receiptSent ? now : null,
        onlinePaymentProvider: seed.invoice.online ? "stripe" : null,
        onlinePaymentTaxMode: "fixed",
        onlinePaymentStatus: seed.invoice.online?.status ?? null,
        onlinePaymentSessionId: seed.invoice.online?.sessionId ?? null,
        onlinePaymentIntentId: seed.invoice.online?.paymentIntentId ?? null,
        onlinePaymentUrl: seed.invoice.online?.url ?? null,
        onlinePaymentExpiresAt: seed.invoice.online?.expiresInDays
          ? dateOffset(seed.invoice.online.expiresInDays)
          : null,
        createdAt: invoiceCreated,
        updatedAt: now,
      });
    }

    if (seed.refund) {
      await db.insert(orderRefund).values({
        id: seed.refund.id,
        orderId: seed.id,
        invoiceId: seed.invoice?.id ?? null,
        amountCents: seed.refund.amountCents,
        currency: "USD",
        status: seed.refund.status,
        provider: seed.refund.provider,
        method: seed.refund.method,
        reference: seed.refund.reference,
        reason: seed.refund.reason,
        note: seed.refund.note,
        refundedAt: dateOffset(-3),
        receiptSentAt: dateOffset(-3),
      });
    }

    inserted.push({
      id: seed.id,
      statusUrl: orderStatusLink(seed.id),
      invoiceUrl: seed.invoice ? invoiceLink(seed.invoice.id) : null,
      total: money(built.order.totalCents),
      state: `${seed.status}/${seed.fulfillmentStatus}`,
    });
  }

  return inserted;
}

async function seedShopPage() {
  const existing = await db
    .select()
    .from(page)
    .where(eq(page.slug, "shop"))
    .limit(1);
  const block = {
    id: "store-example-shop-block",
    type: "shop",
    style: "tora-grid",
    title: "SHOP",
    body: "Browse example prints, downloads, inventory states, tax, shipping, and cart checkout.",
    source: "all",
    category: "",
    limit: 24,
    showSidebar: true,
    showSearch: true,
    showTagCloud: true,
    showSorting: true,
    showSaleBadge: true,
    showPrices: true,
    theme: "auto",
    backgroundColor: "#252626",
    textColor: "#f7f7f7",
    accentColor: "#ddc59f",
  };

  if (!existing[0]) {
    await db.insert(page).values({
      id: SHOP_PAGE_ID,
      slug: "shop",
      title: "Shop",
      type: "standard",
      status: "published",
      blocks: [block],
      sortOrder: 80,
      publishedAt: new Date(),
    });
    console.log("[store-examples] created /shop page");
    return SHOP_PAGE_ID;
  }

  const existingBlocks = Array.isArray(existing[0].blocks) ? existing[0].blocks : [];
  const isSeeded =
    existing[0].id === SHOP_PAGE_ID ||
    existingBlocks.some(
      (item) =>
        item &&
        typeof item === "object" &&
        "id" in item &&
        item.id === "store-example-shop-block",
    );
  if (isSeeded) {
    await db
      .update(page)
      .set({
        title: "Shop",
        type: "standard",
        status: "published",
        blocks: [block],
        publishedAt: new Date(),
      })
      .where(eq(page.id, existing[0].id));
    console.log("[store-examples] refreshed /shop example page");
    return existing[0].id;
  }

  console.log(
    "[store-examples] /shop already exists and was not replaced; add a Shop block manually if needed",
  );
  return existing[0].id;
}

async function addShopMenuItem(shopPageId: string) {
  await ensureMenusSeeded();
  const activeMenu = await db
    .select()
    .from(menu)
    .where(eq(menu.role, "primary"))
    .orderBy(desc(menu.isActive), asc(menu.name))
    .limit(1);
  const primary = activeMenu[0];
  if (!primary) return;

  const existing = await db
    .select({ id: menuItem.id })
    .from(menuItem)
    .where(
      or(
        eq(menuItem.id, SHOP_MENU_ITEM_ID),
        eq(menuItem.url, "/shop"),
        eq(menuItem.targetId, shopPageId),
      ),
    )
    .limit(1);
  if (!existing[0]) {
    await db.insert(menuItem).values({
      id: SHOP_MENU_ITEM_ID,
      menuId: primary.id,
      label: "Shop",
      linkType: "page",
      targetId: shopPageId,
      sortOrder: 70,
      isVisible: true,
    });
    console.log("[store-examples] added Shop to primary menu");
  }
  await invalidateMenu("primary");
}

async function main() {
  await cleanup();
  await applyStoreSettings();

  const photos = await db
    .select({ id: photo.id })
    .from(photo)
    .orderBy(desc(photo.createdAt))
    .limit(12);
  const products = await seedProducts(photos.map((row) => row.id));
  const shopPageId = await seedShopPage();
  await addShopMenuItem(shopPageId);
  const orders = await seedOrders(products);

  console.log("\n[store-examples] ready");
  console.log(`  Shop: ${BASE_URL}/shop`);
  console.log(`  Cart: ${BASE_URL}/cart`);
  console.log(`  Admin Store: ${BASE_URL}/admin/store`);
  console.log("  Promo codes: WELCOME10, PRINT25");
  console.log("\n  Product pages:");
  for (const row of products) {
    console.log(`    ${row.name}: ${BASE_URL}/product/${row.slug}`);
  }
  console.log("\n  Seeded order links:");
  for (const row of orders) {
    console.log(`    ${row.id} (${row.state}, ${row.total})`);
    console.log(`      status:  ${row.statusUrl}`);
    if (row.invoiceUrl) console.log(`      invoice: ${row.invoiceUrl}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[store-examples] failed", err);
  process.exit(1);
});
