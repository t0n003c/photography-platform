import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  client,
  invoice,
  order as orderTable,
  orderItem,
} from "@/src/db/schema";
import { hashToken } from "@/src/auth/grant";
import { issueInvoiceToken, verifyInvoiceToken } from "@/src/auth/invoice-token";
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

export type OrderStatus =
  | "draft"
  | "pending"
  | "invoiced"
  | "paid"
  | "fulfilled"
  | "cancelled";

export type FulfillmentStatus =
  | "unfulfilled"
  | "in_progress"
  | "ready"
  | "shipped"
  | "delivered"
  | "cancelled";

export type InvoiceStatus = "draft" | "issued" | "paid" | "void";
export type OnlinePaymentStatus =
  | "requires_payment"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export interface AdminInvoiceDTO {
  id: string;
  number: string;
  status: InvoiceStatus;
  amountCents: number;
  currency: string;
  notes: string | null;
  paymentInstructions: string | null;
  issuedAt: string | null;
  sentAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paidAmountCents: number | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  receiptSentAt: string | null;
  onlinePaymentProvider: "stripe" | null;
  onlinePaymentStatus: OnlinePaymentStatus | null;
  onlinePaymentSessionId: string | null;
  onlinePaymentIntentId: string | null;
  onlinePaymentUrl: string | null;
  onlinePaymentExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentCarrier: string | null;
  fulfillmentTrackingNumber: string | null;
  fulfillmentTrackingUrl: string | null;
  fulfillmentReadyAt: string | null;
  fulfillmentShippedAt: string | null;
  fulfillmentDeliveredAt: string | null;
  fulfillmentNotes: string | null;
  storeSettingsSnapshot: PublicStoreCheckoutSettings;
  invoice: AdminInvoiceDTO | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItemDTO[];
}

export interface PublicInvoiceDTO {
  invoice: AdminInvoiceDTO;
  order: AdminOrderDTO;
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

function cleanOptionalText(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function invoiceToDTO(row: typeof invoice.$inferSelect): AdminInvoiceDTO {
  return {
    id: row.id,
    number: row.number,
    status: row.status as InvoiceStatus,
    amountCents: row.amountCents,
    currency: row.currency,
    notes: row.notes,
    paymentInstructions: row.paymentInstructions,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidAmountCents: row.paidAmountCents,
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    paymentNote: row.paymentNote,
    receiptSentAt: row.receiptSentAt?.toISOString() ?? null,
    onlinePaymentProvider: row.onlinePaymentProvider as "stripe" | null,
    onlinePaymentStatus: row.onlinePaymentStatus as OnlinePaymentStatus | null,
    onlinePaymentSessionId: row.onlinePaymentSessionId,
    onlinePaymentIntentId: row.onlinePaymentIntentId,
    onlinePaymentUrl: row.onlinePaymentUrl,
    onlinePaymentExpiresAt: row.onlinePaymentExpiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function fulfillmentFieldsToDTO(row: typeof orderTable.$inferSelect) {
  return {
    fulfillmentStatus: row.fulfillmentStatus as FulfillmentStatus,
    fulfillmentCarrier: row.fulfillmentCarrier,
    fulfillmentTrackingNumber: row.fulfillmentTrackingNumber,
    fulfillmentTrackingUrl: row.fulfillmentTrackingUrl,
    fulfillmentReadyAt: row.fulfillmentReadyAt?.toISOString() ?? null,
    fulfillmentShippedAt: row.fulfillmentShippedAt?.toISOString() ?? null,
    fulfillmentDeliveredAt: row.fulfillmentDeliveredAt?.toISOString() ?? null,
    fulfillmentNotes: row.fulfillmentNotes,
  };
}

function invoiceNumber() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  return `INV-${stamp}-${newId().slice(-6)}`;
}

function isClosedStatus(status: OrderStatus) {
  return status === "paid" || status === "fulfilled" || status === "cancelled";
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

export interface HostedCheckoutRefs {
  orderId: string;
  invoiceId: string;
  invoiceNumber: string;
}

export interface HostedCheckoutSessionRecord {
  id: string;
  url: string;
  paymentIntentId?: string | null;
  expiresAt?: Date | null;
}

export function createHostedCheckoutRefs(): HostedCheckoutRefs {
  return {
    orderId: newId(),
    invoiceId: newId(),
    invoiceNumber: invoiceNumber(),
  };
}

export async function createHostedCheckoutOrder(
  summary: CartSummaryDTO,
  customer: CheckoutCustomerInput,
  refs: HostedCheckoutRefs,
  session: HostedCheckoutSessionRecord,
): Promise<ManualCheckoutOrderDTO> {
  const clientId = await createCheckoutClient(customer);
  const createdAt = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(orderTable).values({
      id: refs.orderId,
      clientId,
      email: customer.email.trim().toLowerCase(),
      status: "pending",
      subtotalCents: summary.subtotalCents,
      taxCents: summary.taxCents,
      shippingCents: summary.shippingCents,
      totalCents: summary.totalCents,
      currency: summary.currency,
      paymentProvider: "stripe",
      paymentRef: session.id,
      storeSettingsSnapshot: summary.checkoutSettings,
      createdAt,
      updatedAt: createdAt,
    });

    await tx.insert(orderItem).values(
      summary.lines.map((line) => ({
        id: newId(),
        orderId: refs.orderId,
        productId: line.product.id,
        photoId: line.product.photoId,
        description: lineDescription(line.product.name, line.selectedOptions),
        options: line.selectedOptions,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.lineTotalCents,
      })),
    );

    await tx.insert(invoice).values({
      id: refs.invoiceId,
      orderId: refs.orderId,
      number: refs.invoiceNumber,
      status: "issued",
      amountCents: summary.totalCents,
      currency: summary.currency,
      paymentInstructions: "Pay securely online by card.",
      issuedAt: createdAt,
      onlinePaymentProvider: "stripe",
      onlinePaymentStatus: "pending",
      onlinePaymentSessionId: session.id,
      onlinePaymentIntentId: session.paymentIntentId ?? null,
      onlinePaymentUrl: session.url,
      onlinePaymentExpiresAt: session.expiresAt ?? null,
      createdAt,
      updatedAt: createdAt,
    });
  });

  return {
    orderId: refs.orderId,
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

  const [itemRows, clientRows, invoiceRows] = await Promise.all([
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
    db.select().from(invoice).where(inArray(invoice.orderId, orderIds)),
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
  const invoicesByOrder = new Map(invoiceRows.map((row) => [row.orderId, row]));
  return rows.map((row) => {
    const clientRow = row.clientId ? (clientsById.get(row.clientId) ?? null) : null;
    const invoiceRow = invoicesByOrder.get(row.id);
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
      ...fulfillmentFieldsToDTO(row),
      storeSettingsSnapshot: orderSettingsSnapshot(row.storeSettingsSnapshot),
      invoice: invoiceRow ? invoiceToDTO(invoiceRow) : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items: itemsByOrder.get(row.id) ?? [],
    };
  });
}

export async function getOrderAdmin(id: string): Promise<AdminOrderDTO | null> {
  const rows = await db.select().from(orderTable).where(eq(orderTable.id, id)).limit(1);
  if (!rows[0]) return null;

  const [itemRows, clientRows, invoiceRows] = await Promise.all([
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
    db.select().from(invoice).where(eq(invoice.orderId, id)).limit(1),
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
    ...fulfillmentFieldsToDTO(row),
    storeSettingsSnapshot: orderSettingsSnapshot(row.storeSettingsSnapshot),
    invoice: invoiceRows[0] ? invoiceToDTO(invoiceRows[0]) : null,
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
  await db.transaction(async (tx) => {
    await tx.update(orderTable).set({ status }).where(eq(orderTable.id, id));
    if (status === "paid") {
      const now = new Date();
      await tx
        .update(invoice)
        .set({
          status: "paid",
          paidAt: now,
          paidAmountCents: sql`coalesce(${invoice.paidAmountCents}, ${invoice.amountCents})`,
        })
        .where(eq(invoice.orderId, id));
    } else if (status === "cancelled") {
      await tx
        .update(invoice)
        .set({ status: "void" })
        .where(eq(invoice.orderId, id));
    }
  });
  return getOrderAdmin(id);
}

export async function saveInvoiceAdmin(
  orderId: string,
  input: {
    dueAt?: Date | null;
    notes?: string | null;
    paymentInstructions?: string | null;
    issue?: boolean;
  },
): Promise<{ order: AdminOrderDTO; invoiceToken: string | null } | null> {
  await db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orderTable)
      .where(eq(orderTable.id, orderId))
      .limit(1);
    const row = orderRows[0];
    if (!row) return;

    const invoiceRows = await tx
      .select()
      .from(invoice)
      .where(eq(invoice.orderId, orderId))
      .limit(1);
    const current = invoiceRows[0];
    const now = new Date();
    const notes = cleanOptionalText(input.notes);
    const paymentInstructions = cleanOptionalText(input.paymentInstructions);
    const status =
      current?.status === "paid" || current?.status === "void"
        ? current.status
        : input.issue
          ? "issued"
          : (current?.status ?? "draft");
    const issuedAt = input.issue ? (current?.issuedAt ?? now) : current?.issuedAt;
    const sentAt = input.issue ? now : current?.sentAt;

    if (current) {
      await tx
        .update(invoice)
        .set({
          status,
          amountCents: row.totalCents,
          currency: row.currency,
          notes,
          paymentInstructions,
          dueAt: input.dueAt ?? null,
          issuedAt,
          sentAt,
        })
        .where(eq(invoice.id, current.id));
    } else {
      await tx.insert(invoice).values({
        id: newId(),
        orderId,
        number: invoiceNumber(),
        status,
        amountCents: row.totalCents,
        currency: row.currency,
        notes,
        paymentInstructions,
        dueAt: input.dueAt ?? null,
        issuedAt: issuedAt ?? null,
        sentAt: sentAt ?? null,
      });
    }

    if (input.issue && !isClosedStatus(row.status as OrderStatus)) {
      await tx
        .update(orderTable)
        .set({ status: "invoiced" })
        .where(eq(orderTable.id, orderId));
    }
  });

  const order = await getOrderAdmin(orderId);
  if (!order) return null;
  return {
    order,
    invoiceToken: input.issue && order.invoice ? issueInvoiceToken(order.invoice.id) : null,
  };
}

export async function recordInvoicePaymentAdmin(
  orderId: string,
  input: {
    paidAt?: Date | null;
    paidAmountCents?: number | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentNote?: string | null;
    sendReceipt?: boolean;
  },
): Promise<{ order: AdminOrderDTO; invoiceToken: string | null } | null> {
  await db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orderTable)
      .where(eq(orderTable.id, orderId))
      .limit(1);
    const row = orderRows[0];
    if (!row) return;

    const invoiceRows = await tx
      .select()
      .from(invoice)
      .where(eq(invoice.orderId, orderId))
      .limit(1);
    const current = invoiceRows[0];
    const now = new Date();
    const paidAt = input.paidAt ?? current?.paidAt ?? now;
    const paidAmountCents =
      input.paidAmountCents && input.paidAmountCents > 0
        ? input.paidAmountCents
        : (current?.paidAmountCents ?? row.totalCents);
    const paymentMethod = cleanOptionalText(input.paymentMethod);
    const paymentReference = cleanOptionalText(input.paymentReference);
    const paymentNote = cleanOptionalText(input.paymentNote);
    const receiptSentAt = input.sendReceipt ? now : current?.receiptSentAt;

    if (current) {
      await tx
        .update(invoice)
        .set({
          status: "paid",
          amountCents: row.totalCents,
          currency: row.currency,
          paidAt,
          paidAmountCents,
          paymentMethod,
          paymentReference,
          paymentNote,
          receiptSentAt,
        })
        .where(eq(invoice.id, current.id));
    } else {
      await tx.insert(invoice).values({
        id: newId(),
        orderId,
        number: invoiceNumber(),
        status: "paid",
        amountCents: row.totalCents,
        currency: row.currency,
        issuedAt: now,
        paidAt,
        paidAmountCents,
        paymentMethod,
        paymentReference,
        paymentNote,
        receiptSentAt,
      });
    }

    await tx
      .update(orderTable)
      .set({ status: "paid" })
      .where(eq(orderTable.id, orderId));
  });

  const order = await getOrderAdmin(orderId);
  if (!order) return null;
  return {
    order,
    invoiceToken:
      input.sendReceipt && order.invoice ? issueInvoiceToken(order.invoice.id) : null,
  };
}

export async function updateOrderFulfillmentAdmin(
  orderId: string,
  input: {
    fulfillmentStatus: FulfillmentStatus;
    fulfillmentCarrier?: string | null;
    fulfillmentTrackingNumber?: string | null;
    fulfillmentTrackingUrl?: string | null;
    fulfillmentReadyAt?: Date | null;
    fulfillmentShippedAt?: Date | null;
    fulfillmentDeliveredAt?: Date | null;
    fulfillmentNotes?: string | null;
  },
): Promise<AdminOrderDTO | null> {
  await db.transaction(async (tx) => {
    const orderRows = await tx
      .select()
      .from(orderTable)
      .where(eq(orderTable.id, orderId))
      .limit(1);
    const current = orderRows[0];
    if (!current) return;

    const now = new Date();
    let readyAt =
      input.fulfillmentReadyAt !== undefined
        ? input.fulfillmentReadyAt
        : current.fulfillmentReadyAt;
    let shippedAt =
      input.fulfillmentShippedAt !== undefined
        ? input.fulfillmentShippedAt
        : current.fulfillmentShippedAt;
    let deliveredAt =
      input.fulfillmentDeliveredAt !== undefined
        ? input.fulfillmentDeliveredAt
        : current.fulfillmentDeliveredAt;

    if (
      (input.fulfillmentStatus === "ready" ||
        input.fulfillmentStatus === "shipped" ||
        input.fulfillmentStatus === "delivered") &&
      !readyAt
    ) {
      readyAt = now;
    }
    if (
      (input.fulfillmentStatus === "shipped" ||
        input.fulfillmentStatus === "delivered") &&
      !shippedAt
    ) {
      shippedAt = now;
    }
    if (input.fulfillmentStatus === "delivered" && !deliveredAt) {
      deliveredAt = now;
    }

    const currentStatus = current.status as OrderStatus;
    const nextOrderStatus =
      input.fulfillmentStatus === "delivered"
        ? "fulfilled"
        : currentStatus === "fulfilled"
          ? "paid"
          : currentStatus;

    await tx
      .update(orderTable)
      .set({
        status: nextOrderStatus,
        fulfillmentStatus: input.fulfillmentStatus,
        fulfillmentCarrier: cleanOptionalText(input.fulfillmentCarrier),
        fulfillmentTrackingNumber: cleanOptionalText(input.fulfillmentTrackingNumber),
        fulfillmentTrackingUrl: cleanOptionalText(input.fulfillmentTrackingUrl),
        fulfillmentReadyAt: readyAt,
        fulfillmentShippedAt: shippedAt,
        fulfillmentDeliveredAt: deliveredAt,
        fulfillmentNotes: cleanOptionalText(input.fulfillmentNotes),
        updatedAt: now,
      })
      .where(eq(orderTable.id, orderId));
  });

  return getOrderAdmin(orderId);
}

export async function attachInvoiceOnlineCheckoutSession(
  invoiceId: string,
  session: HostedCheckoutSessionRecord,
): Promise<AdminOrderDTO | null> {
  const invoiceRows = await db
    .select()
    .from(invoice)
    .where(eq(invoice.id, invoiceId))
    .limit(1);
  const current = invoiceRows[0];
  if (!current || current.status === "paid" || current.status === "void") return null;

  await db.transaction(async (tx) => {
    await tx
      .update(invoice)
      .set({
        onlinePaymentProvider: "stripe",
        onlinePaymentStatus: "pending",
        onlinePaymentSessionId: session.id,
        onlinePaymentIntentId: session.paymentIntentId ?? null,
        onlinePaymentUrl: session.url,
        onlinePaymentExpiresAt: session.expiresAt ?? null,
      })
      .where(eq(invoice.id, invoiceId));
    await tx
      .update(orderTable)
      .set({
        paymentProvider: "stripe",
        paymentRef: session.id,
      })
      .where(eq(orderTable.id, current.orderId));
  });

  return getOrderAdmin(current.orderId);
}

async function invoiceByOnlinePayment(input: {
  invoiceId?: string | null;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}) {
  if (input.invoiceId) {
    const rows = await db
      .select()
      .from(invoice)
      .where(eq(invoice.id, input.invoiceId))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  if (input.sessionId) {
    const rows = await db
      .select()
      .from(invoice)
      .where(eq(invoice.onlinePaymentSessionId, input.sessionId))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  if (input.paymentIntentId) {
    const rows = await db
      .select()
      .from(invoice)
      .where(eq(invoice.onlinePaymentIntentId, input.paymentIntentId))
      .limit(1);
    if (rows[0]) return rows[0];
  }
  return null;
}

export async function recordStripeCheckoutPaid(input: {
  invoiceId?: string | null;
  sessionId: string;
  paymentIntentId?: string | null;
  amountPaidCents?: number | null;
}): Promise<
  | {
      order: AdminOrderDTO;
      invoice: AdminInvoiceDTO;
      wasAlreadyPaid: boolean;
    }
  | null
> {
  const current = await invoiceByOnlinePayment(input);
  if (!current) return null;
  const wasAlreadyPaid = current.status === "paid";
  const paidAt = current.paidAt ?? new Date();
  const paidAmountCents =
    input.amountPaidCents && input.amountPaidCents > 0
      ? input.amountPaidCents
      : (current.paidAmountCents ?? current.amountCents);

  if (!wasAlreadyPaid) {
    await db.transaction(async (tx) => {
      await tx
        .update(invoice)
        .set({
          status: "paid",
          paidAt,
          paidAmountCents,
          paymentMethod: "Stripe Checkout",
          paymentReference: input.paymentIntentId ?? input.sessionId,
          paymentNote: "Paid online via Stripe Checkout.",
          onlinePaymentProvider: "stripe",
          onlinePaymentStatus: "paid",
          onlinePaymentSessionId: input.sessionId,
          onlinePaymentIntentId:
            input.paymentIntentId ?? current.onlinePaymentIntentId ?? null,
        })
        .where(eq(invoice.id, current.id));
      await tx
        .update(orderTable)
        .set({
          status: "paid",
          paymentProvider: "stripe",
          paymentRef: input.paymentIntentId ?? input.sessionId,
        })
        .where(eq(orderTable.id, current.orderId));
    });
  }

  const order = await getOrderAdmin(current.orderId);
  if (!order?.invoice) return null;
  return {
    order,
    invoice: order.invoice,
    wasAlreadyPaid,
  };
}

export async function recordStripeCheckoutExpired(input: {
  invoiceId?: string | null;
  sessionId?: string | null;
}): Promise<AdminOrderDTO | null> {
  const current = await invoiceByOnlinePayment(input);
  if (!current || current.status === "paid" || current.status === "void") {
    return current ? getOrderAdmin(current.orderId) : null;
  }
  await db
    .update(invoice)
    .set({
      onlinePaymentStatus: "expired",
      onlinePaymentUrl: null,
    })
    .where(eq(invoice.id, current.id));
  return getOrderAdmin(current.orderId);
}

export async function getPublicInvoiceByToken(
  rawToken: string,
): Promise<PublicInvoiceDTO | null> {
  const signedInvoiceId = verifyInvoiceToken(rawToken);
  const invoiceRows = signedInvoiceId
    ? await db
        .select()
        .from(invoice)
        .where(eq(invoice.id, signedInvoiceId))
        .limit(1)
    : await db
        .select()
        .from(invoice)
        .where(eq(invoice.publicTokenHash, hashToken(rawToken)))
        .limit(1);
  const invoiceRow = invoiceRows[0];
  if (!invoiceRow || invoiceRow.status === "draft" || invoiceRow.status === "void") {
    return null;
  }
  const order = await getOrderAdmin(invoiceRow.orderId);
  if (!order) return null;
  return {
    invoice: invoiceToDTO(invoiceRow),
    order,
  };
}
