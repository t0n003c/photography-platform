import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { client, order as orderTable, orderItem } from "@/src/db/schema";
import { newId } from "@/src/lib/id";
import type { CartSummaryDTO } from "@/src/db/queries/store";
import {
  normalizeSelectedOptions,
  selectedOptionsLabel,
  type SelectedProductOption,
} from "@/src/lib/store-options";
import {
  normalizeStoreCheckoutSettings,
  publicStoreCheckoutSettings,
  type PublicStoreCheckoutSettings,
} from "@/src/lib/store-settings";

export interface CheckoutCustomerInput {
  name?: string | null;
  email: string;
  phone?: string | null;
  notes?: string | null;
}

export interface ManualCheckoutOrderDTO {
  orderId: string;
  clientId: string | null;
  status: "pending";
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  itemCount: number;
  createdAt: string;
  checkoutSettings: PublicStoreCheckoutSettings;
}

export type OrderStatus = "draft" | "pending" | "paid" | "fulfilled" | "cancelled";

export interface AdminOrderItemDTO {
  id: string;
  productId: string | null;
  photoId: string | null;
  description: string | null;
  options: SelectedProductOption[];
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface AdminOrderDTO {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientNotes: string | null;
  email: string | null;
  status: OrderStatus;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  storeSettingsSnapshot: PublicStoreCheckoutSettings;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItemDTO[];
}

function lineDescription(name: string, options: SelectedProductOption[]) {
  const label = selectedOptionsLabel(options);
  return label ? `${name} — ${label}` : name;
}

function orderSettingsSnapshot(input: unknown): PublicStoreCheckoutSettings {
  return publicStoreCheckoutSettings(
    normalizeStoreCheckoutSettings(
      input && typeof input === "object"
        ? (input as Partial<PublicStoreCheckoutSettings>)
        : {},
    ),
  );
}

async function findExistingClientByEmail(email: string) {
  const rows = await db
    .select({ id: client.id })
    .from(client)
    .where(
      and(
        sql`lower(${client.email}) = ${email.toLowerCase()}`,
        isNull(client.deletedAt),
      ),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

async function createCheckoutClient(customer: CheckoutCustomerInput) {
  const existingId = await findExistingClientByEmail(customer.email);
  if (existingId) {
    const updates: Partial<typeof client.$inferInsert> = {};
    if (customer.name?.trim()) updates.name = customer.name.trim();
    if (customer.phone?.trim()) updates.phone = customer.phone.trim();
    if (customer.notes?.trim()) updates.notes = customer.notes.trim();
    if (Object.keys(updates).length > 0) {
      await db.update(client).set(updates).where(eq(client.id, existingId));
    }
    return existingId;
  }

  const id = newId();
  await db.insert(client).values({
    id,
    name: customer.name?.trim() || null,
    email: customer.email.trim().toLowerCase(),
    phone: customer.phone?.trim() || null,
    notes: customer.notes?.trim() || null,
  });
  return id;
}

export async function createManualCheckoutOrder(
  summary: CartSummaryDTO,
  customer: CheckoutCustomerInput,
): Promise<ManualCheckoutOrderDTO> {
  const clientId = await createCheckoutClient(customer);
  const orderId = newId();
  const createdAt = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(orderTable).values({
      id: orderId,
      clientId,
      email: customer.email.trim().toLowerCase(),
      status: "pending",
      subtotalCents: summary.subtotalCents,
      taxCents: summary.taxCents,
      shippingCents: summary.shippingCents,
      totalCents: summary.totalCents,
      currency: summary.currency,
      paymentProvider: "manual",
      paymentRef: "Manual invoice requested",
      storeSettingsSnapshot: summary.checkoutSettings,
      createdAt,
      updatedAt: createdAt,
    });

    await tx.insert(orderItem).values(
      summary.lines.map((line) => ({
        id: newId(),
        orderId,
        productId: line.product.id,
        photoId: line.product.photoId,
        description: lineDescription(line.product.name, line.selectedOptions),
        options: line.selectedOptions,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.lineTotalCents,
      })),
    );
  });

  return {
    orderId,
    clientId,
    status: "pending",
    subtotalCents: summary.subtotalCents,
    taxCents: summary.taxCents,
    shippingCents: summary.shippingCents,
    totalCents: summary.totalCents,
    currency: summary.currency,
    itemCount: summary.lines.reduce((sum, line) => sum + line.quantity, 0),
    createdAt: createdAt.toISOString(),
    checkoutSettings: summary.checkoutSettings,
  };
}

export async function listOrdersAdmin(limit = 50): Promise<AdminOrderDTO[]> {
  const rows = await db
    .select()
    .from(orderTable)
    .orderBy(desc(orderTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));

  if (rows.length === 0) return [];
  const orderIds = rows.map((row) => row.id);
  const clientIds = rows.map((row) => row.clientId).filter(Boolean) as string[];

  const [itemRows, clientRows] = await Promise.all([
    db.select().from(orderItem).where(inArray(orderItem.orderId, orderIds)),
    clientIds.length
      ? db
          .select({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
          })
          .from(client)
          .where(inArray(client.id, clientIds))
      : Promise.resolve([]),
  ]);

  const itemsByOrder = new Map<string, AdminOrderItemDTO[]>();
  for (const item of itemRows) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push({
      id: item.id,
      productId: item.productId,
      photoId: item.photoId,
      description: item.description,
      options: normalizeSelectedOptions(item.options),
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    });
    itemsByOrder.set(item.orderId, list);
  }

  const clientsById = new Map(clientRows.map((row) => [row.id, row]));
  return rows.map((row) => {
    const clientRow = row.clientId ? (clientsById.get(row.clientId) ?? null) : null;
    return {
      id: row.id,
      clientId: row.clientId,
      clientName: clientRow?.name ?? null,
      clientPhone: clientRow?.phone ?? null,
      clientNotes: clientRow?.notes ?? null,
      email: row.email ?? clientRow?.email ?? null,
      status: row.status,
      subtotalCents: row.subtotalCents,
      taxCents: row.taxCents,
      shippingCents: row.shippingCents,
      totalCents: row.totalCents,
      currency: row.currency,
      paymentProvider: row.paymentProvider,
      paymentRef: row.paymentRef,
      storeSettingsSnapshot: orderSettingsSnapshot(row.storeSettingsSnapshot),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: itemsByOrder.get(row.id) ?? [],
    };
  });
}

export async function getOrderAdmin(id: string): Promise<AdminOrderDTO | null> {
  const rows = await db.select().from(orderTable).where(eq(orderTable.id, id)).limit(1);
  if (!rows[0]) return null;

  const [itemRows, clientRows] = await Promise.all([
    db.select().from(orderItem).where(eq(orderItem.orderId, id)),
    rows[0].clientId
      ? db
          .select({
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone,
            notes: client.notes,
          })
          .from(client)
          .where(eq(client.id, rows[0].clientId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const row = rows[0];
  const clientRow = clientRows[0] ?? null;
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: clientRow?.name ?? null,
    clientPhone: clientRow?.phone ?? null,
    clientNotes: clientRow?.notes ?? null,
    email: row.email ?? clientRow?.email ?? null,
    status: row.status,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    shippingCents: row.shippingCents,
    totalCents: row.totalCents,
    currency: row.currency,
    paymentProvider: row.paymentProvider,
    paymentRef: row.paymentRef,
    storeSettingsSnapshot: orderSettingsSnapshot(row.storeSettingsSnapshot),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    items: itemRows.map((item) => ({
      id: item.id,
      productId: item.productId,
      photoId: item.photoId,
      description: item.description,
      options: normalizeSelectedOptions(item.options),
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

export async function updateOrderStatusAdmin(
  id: string,
  status: OrderStatus,
): Promise<AdminOrderDTO | null> {
  await db.update(orderTable).set({ status }).where(eq(orderTable.id, id));
  return getOrderAdmin(id);
}
