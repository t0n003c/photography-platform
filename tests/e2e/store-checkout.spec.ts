import { randomUUID } from "node:crypto";
import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";
import postgres from "postgres";

const DEFAULT_DATABASE_URL = "postgres://photog:photog@127.0.0.1:5432/photography";

const BENIGN_CONSOLE = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Download the React DevTools/i,
  /serwist/i,
  /workbox/i,
];

type CheckoutResponse = {
  data: {
    orderId: string;
    status: "pending";
    customerEmail: string;
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    itemCount: number;
    statusUrl?: string | null;
  };
};

type CartResponse = {
  data: {
    lines: Array<{
      product: { id: string; name: string };
      quantity: number;
      lineTotalCents: number;
    }>;
    subtotalCents: number;
    taxCents: number;
    shippingCents: number;
    totalCents: number;
    unavailableProductIds: string[];
    availabilityErrors: unknown[];
  };
};

type StatusResponse = {
  data: {
    order: {
      id: string;
      status: string;
      fulfillmentStatus: string;
      fulfillmentCarrier: string | null;
      fulfillmentTrackingNumber: string | null;
      fulfillmentTrackingUrl: string | null;
      totalCents: number;
      items: Array<{ quantity: number; lineTotalCents: number }>;
    };
    statusUrl: string;
  };
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type SettingsBackup = {
  store_online_payments_enabled: boolean;
  store_payment_provider: "manual" | "stripe";
  store_tax_enabled: boolean;
  store_tax_rate_bps: number;
  store_shipping_mode: "manual" | "free" | "flat";
  store_shipping_flat_cents: number;
  store_shipping_profiles: JsonValue;
  store_promo_codes: JsonValue;
};

function e2eDatabaseUrl() {
  const configured = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!configured) return DEFAULT_DATABASE_URL;
  try {
    const url = new URL(configured);
    if (url.hostname === "db") url.hostname = "127.0.0.1";
    return url.toString();
  } catch {
    return DEFAULT_DATABASE_URL;
  }
}

function collectConsoleErrors(messages: string[]) {
  return (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    messages.push(text);
  };
}

async function openCleanPage(page: Page, url: string, errors: string[]) {
  const response = await page.goto(url);
  expect(response?.status(), `${url} returned ${response?.status()}`).toBeLessThan(500);
  expect(errors, `unexpected browser errors on ${url}:\n${errors.join("\n")}`).toEqual(
    [],
  );
}

test("store cart, manual checkout, and order status stay healthy", async ({
  page,
  request,
}) => {
  const sql = postgres(e2eDatabaseUrl(), { max: 1, connect_timeout: 5 });
  const suffix = randomUUID().slice(0, 8);
  const productId = `e2e-product-${suffix}`;
  const slug = `e2e-store-smoke-${suffix}`;
  const sku = `E2E-${suffix.toUpperCase()}`;
  const customerEmail = `store-smoke-${suffix}@example.test`;
  let createdOrderId: string | null = null;
  let createdClientId: string | null = null;
  let settingsBackup: SettingsBackup | null = null;

  const browserErrors: string[] = [];
  page.on("console", collectConsoleErrors(browserErrors));
  page.on("pageerror", (err) => browserErrors.push(err.message));

  try {
    const settingsRows = await sql<SettingsBackup[]>`
      select
        store_online_payments_enabled,
        store_payment_provider,
        store_tax_enabled,
        store_tax_rate_bps,
        store_shipping_mode,
        store_shipping_flat_cents,
        store_shipping_profiles,
        store_promo_codes
      from site_settings
      where id = 'site'
      limit 1
    `;
    settingsBackup = settingsRows[0] ?? null;

    if (settingsBackup) {
      await sql`
        update site_settings
        set
          store_online_payments_enabled = false,
          store_payment_provider = 'manual',
          store_tax_enabled = false,
          store_tax_rate_bps = 0,
          store_shipping_mode = 'manual',
          store_shipping_flat_cents = 0,
          store_shipping_profiles = '[]'::jsonb,
          store_promo_codes = '[]'::jsonb,
          updated_at = now()
        where id = 'site'
      `;
    }

    await sql`
      insert into product (
        id,
        slug,
        sku,
        name,
        description,
        kind,
        base_price_cents,
        currency,
        category,
        inventory_tracked,
        stock_quantity,
        low_stock_threshold,
        allow_backorder,
        tags,
        options,
        is_featured,
        is_active,
        sort_order,
        created_at,
        updated_at
      )
      values (
        ${productId},
        ${slug},
        ${sku},
        'E2E Store Smoke Print',
        'Temporary product created by the store checkout smoke test.',
        'print',
        12345,
        'USD',
        'Smoke',
        true,
        8,
        2,
        false,
        '["smoke"]'::jsonb,
        '[]'::jsonb,
        true,
        true,
        999999,
        now(),
        now()
      )
    `;

    const items = [{ productId, quantity: 2 }];
    const cartResponse = await request.post("/api/v1/cart", { data: { items } });
    expect(cartResponse.ok()).toBeTruthy();
    const cart = (await cartResponse.json()) as CartResponse;
    expect(cart.data.unavailableProductIds).toEqual([]);
    expect(cart.data.availabilityErrors).toEqual([]);
    expect(cart.data.lines).toHaveLength(1);
    expect(cart.data.lines[0].lineTotalCents).toBe(24690);
    expect(cart.data.subtotalCents).toBe(24690);
    expect(cart.data.taxCents).toBe(0);
    expect(cart.data.shippingCents).toBe(0);
    expect(cart.data.totalCents).toBe(24690);

    const checkoutResponse = await request.post("/api/v1/checkout", {
      data: {
        customer: {
          name: "Store Smoke Customer",
          email: customerEmail,
          phone: "555-0100",
          notes: "E2E smoke order. Safe to delete.",
        },
        items,
      },
    });
    expect(checkoutResponse.status()).toBe(201);
    const checkout = (await checkoutResponse.json()) as CheckoutResponse;
    createdOrderId = checkout.data.orderId;
    expect(checkout.data.status).toBe("pending");
    expect(checkout.data.customerEmail).toBe(customerEmail);
    expect(checkout.data.itemCount).toBe(2);
    expect(checkout.data.totalCents).toBe(24690);
    expect(checkout.data.statusUrl).toMatch(/^\/orders\/status\?token=/);

    const clientRows = await sql<{ client_id: string | null }[]>`
      select client_id
      from "order"
      where id = ${createdOrderId}
      limit 1
    `;
    createdClientId = clientRows[0]?.client_id ?? null;

    const lookupResponse = await request.post("/api/v1/orders/status", {
      data: { email: customerEmail, reference: createdOrderId },
    });
    expect(lookupResponse.ok()).toBeTruthy();
    const lookup = (await lookupResponse.json()) as StatusResponse;
    expect(lookup.data.order.id).toBe(createdOrderId);
    expect(lookup.data.order.status).toBe("pending");
    expect(lookup.data.order.fulfillmentStatus).toBe("unfulfilled");
    expect(lookup.data.order.totalCents).toBe(24690);
    expect(lookup.data.order.items).toHaveLength(1);
    expect(lookup.data.statusUrl).toContain("/orders/status?token=");

    await sql`
      update "order"
      set
        status = 'paid',
        fulfillment_status = 'shipped',
        fulfillment_carrier = 'USPS',
        fulfillment_tracking_number = '9400TEST',
        fulfillment_tracking_url = 'https://tracking.example/9400TEST',
        fulfillment_ready_at = '2026-07-11T12:00:00.000Z',
        fulfillment_shipped_at = '2026-07-12T12:00:00.000Z',
        fulfillment_notes = 'Internal-only packing note',
        updated_at = now()
      where id = ${createdOrderId}
    `;

    const fulfilledLookupResponse = await request.post("/api/v1/orders/status", {
      data: { email: customerEmail, reference: createdOrderId },
    });
    expect(fulfilledLookupResponse.ok()).toBeTruthy();
    const fulfilledLookup = (await fulfilledLookupResponse.json()) as StatusResponse;
    expect(fulfilledLookup.data.order.status).toBe("paid");
    expect(fulfilledLookup.data.order.fulfillmentStatus).toBe("shipped");
    expect(fulfilledLookup.data.order.fulfillmentCarrier).toBe("USPS");
    expect(fulfilledLookup.data.order.fulfillmentTrackingNumber).toBe("9400TEST");
    expect(fulfilledLookup.data.order.fulfillmentTrackingUrl).toBe(
      "https://tracking.example/9400TEST",
    );
    expect(JSON.stringify(fulfilledLookup.data.order)).not.toContain(
      "Internal-only packing note",
    );

    await openCleanPage(page, `/product/${slug}`, browserErrors);
    await expect(
      page.getByRole("heading", { level: 1, name: "E2E Store Smoke Print" }),
    ).toBeVisible();

    await openCleanPage(page, "/cart", browserErrors);
    await openCleanPage(page, checkout.data.statusUrl!, browserErrors);
    await expect(page.getByText(/shipped/i).first()).toBeVisible();
    await expect(page.getByText("USPS").first()).toBeVisible();
    await expect(page.getByText("9400TEST").first()).toBeVisible();
    await expect(page.getByText("Internal-only packing note")).toHaveCount(0);

    await openCleanPage(page, "/admin/store", browserErrors);
    await expect(page).toHaveURL(/\/login/);
  } finally {
    if (createdOrderId) {
      await sql`delete from "order" where id = ${createdOrderId}`;
    }
    if (createdClientId) {
      await sql`delete from client where id = ${createdClientId} and email = ${customerEmail}`;
    }
    await sql`delete from product where id = ${productId}`;

    if (settingsBackup) {
      await sql`
        update site_settings
        set
          store_online_payments_enabled = ${settingsBackup.store_online_payments_enabled},
          store_payment_provider = ${settingsBackup.store_payment_provider},
          store_tax_enabled = ${settingsBackup.store_tax_enabled},
          store_tax_rate_bps = ${settingsBackup.store_tax_rate_bps},
          store_shipping_mode = ${settingsBackup.store_shipping_mode},
          store_shipping_flat_cents = ${settingsBackup.store_shipping_flat_cents},
          store_shipping_profiles = ${sql.json(settingsBackup.store_shipping_profiles)},
          store_promo_codes = ${sql.json(settingsBackup.store_promo_codes)},
          updated_at = now()
        where id = 'site'
      `;
    }

    await sql.end();
  }
});
