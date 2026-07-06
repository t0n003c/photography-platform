"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Copy,
  CreditCard,
  Download,
  Eye,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Mail,
  PackageCheck,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useStepUp } from "@/components/admin/step-up";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";
import {
  createStoreOptionId,
  normalizeProductOptions,
  type ProductOption,
  type ProductOptionValue,
  type SelectedProductOption,
} from "@/src/lib/store-options";
import type { OrderPackingChecklistEntry } from "@/src/lib/store-fulfillment";

type ProductKind = "print" | "digital" | "bundle";

interface InvoiceRow {
  id: string;
  number: string;
  status: "draft" | "issued" | "paid" | "void";
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
  onlinePaymentTaxMode: "fixed" | "stripe";
  onlinePaymentStatus:
    | "requires_payment"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | null;
  onlinePaymentSessionId: string | null;
  onlinePaymentIntentId: string | null;
  onlinePaymentUrl: string | null;
  onlinePaymentExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RefundRow {
  id: string;
  orderId: string;
  invoiceId: string | null;
  amountCents: number;
  currency: string;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  provider: string;
  providerRefundId: string | null;
  providerError: string | null;
  method: string | null;
  reference: string | null;
  reason: string | null;
  note: string | null;
  refundedAt: string | null;
  receiptSentAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string | null;
  kind: ProductKind;
  photoId: string | null;
  photo: PhotoDTO | null;
  basePriceCents: number;
  salePriceCents: number | null;
  currency: string;
  category: string | null;
  stripeTaxCode: string | null;
  inventoryTracked: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  allowBackorder: boolean;
  tags: string[];
  options: ProductOption[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface OrderRow {
  id: string;
  clientName: string | null;
  clientPhone: string | null;
  clientNotes: string | null;
  email: string | null;
  status: "draft" | "pending" | "invoiced" | "paid" | "fulfilled" | "cancelled";
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  taxCents: number;
  shippingCents: number;
  shippingProfileId: string | null;
  shippingProfileLabel: string | null;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  fulfillmentStatus:
    | "unfulfilled"
    | "in_progress"
    | "ready"
    | "shipped"
    | "delivered"
    | "cancelled";
  fulfillmentCarrier: string | null;
  fulfillmentTrackingNumber: string | null;
  fulfillmentTrackingUrl: string | null;
  fulfillmentReadyAt: string | null;
  fulfillmentShippedAt: string | null;
  fulfillmentDeliveredAt: string | null;
  fulfillmentNotes: string | null;
  packingChecklist: OrderPackingChecklistEntry[];
  invoice: InvoiceRow | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productId: string | null;
    photoId: string | null;
    description: string | null;
    stripeTaxCode: string | null;
    options: SelectedProductOption[];
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
  refunds: RefundRow[];
}

type OrderStatus = OrderRow["status"];
type FulfillmentStatus = OrderRow["fulfillmentStatus"];
type RefundStatus = RefundRow["status"];
type RefundProvider = "manual" | "stripe";
type SavedOrderFilter =
  | "needs_invoice"
  | "awaiting_payment"
  | "ready_to_ship"
  | "refunds_pending"
  | "completed"
  | "missing_email";
type OrderFilter = "all" | "open" | OrderStatus | SavedOrderFilter;
type ProductOpsFilter =
  | "all"
  | "needs_attention"
  | "low_stock"
  | "sold_out"
  | "backorder"
  | "tracking_off";

interface ProductInventorySnapshot {
  reservedQuantity: number;
  availableQuantity: number;
  status: "not_tracked" | "in_stock" | "low_stock" | "backorder" | "sold_out";
  label: string;
  detail: string;
  tone: ComponentProps<typeof Badge>["tone"];
}

interface OrderReadinessWarning {
  key: string;
  label: string;
  detail: string;
  tone: ComponentProps<typeof Badge>["tone"];
}

interface AuditLogRow {
  id: string;
  actorId: string | null;
  actorType: "user" | "client" | "system";
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
}

interface ActivityEntry {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  tone: ComponentProps<typeof Badge>["tone"];
  source: "order" | "audit";
}

const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "draft",
  "pending",
  "invoiced",
  "paid",
  "fulfilled",
  "cancelled",
];
const OPEN_ORDER_STATUSES = new Set<OrderStatus>([
  "draft",
  "pending",
  "invoiced",
  "paid",
]);
const INVENTORY_RESERVATION_STATUSES = new Set<OrderStatus>([
  "draft",
  "pending",
  "invoiced",
]);
const FULFILLMENT_STATUS_OPTIONS: FulfillmentStatus[] = [
  "unfulfilled",
  "in_progress",
  "ready",
  "shipped",
  "delivered",
  "cancelled",
];
const FULFILLMENT_EMAIL_STATUSES = new Set<FulfillmentStatus>([
  "ready",
  "shipped",
  "delivered",
]);

const SAVED_ORDER_FILTERS: Array<{
  value: SavedOrderFilter;
  label: string;
  description: string;
}> = [
  {
    value: "needs_invoice",
    label: "Needs invoice",
    description: "Open requests without an issued invoice.",
  },
  {
    value: "awaiting_payment",
    label: "Awaiting payment",
    description: "Invoices sent but not marked paid.",
  },
  {
    value: "ready_to_ship",
    label: "Ready to ship",
    description: "Paid orders not yet shipped or delivered.",
  },
  {
    value: "refunds_pending",
    label: "Refunds pending",
    description: "Orders with pending refund records.",
  },
  {
    value: "completed",
    label: "Completed",
    description: "Fulfilled or delivered orders.",
  },
  {
    value: "missing_email",
    label: "Missing email",
    description: "Orders that cannot receive client emails yet.",
  },
];

const PRODUCT_OPS_FILTERS: Array<{
  value: ProductOpsFilter;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "All products",
    description: "Every product in the store.",
  },
  {
    value: "needs_attention",
    label: "Needs attention",
    description: "Tracked products that are low, sold out, or backordered.",
  },
  {
    value: "low_stock",
    label: "Low stock",
    description: "Available inventory is at or under the low-stock threshold.",
  },
  {
    value: "sold_out",
    label: "Sold out",
    description: "Tracked products without available stock or backorder.",
  },
  {
    value: "backorder",
    label: "Backorder",
    description: "Tracked products without available stock but backorder is allowed.",
  },
  {
    value: "tracking_off",
    label: "Tracking off",
    description: "Products that do not currently track inventory.",
  },
];

interface InvoiceFormValues {
  dueAt: string;
  notes: string;
  paymentInstructions: string;
}

interface PaymentFormValues {
  paidAt: string;
  paidAmount: string;
  paymentMethod: string;
  paymentReference: string;
  paymentNote: string;
}

interface RefundFormValues {
  provider: RefundProvider;
  refundedAt: string;
  amount: string;
  method: string;
  reference: string;
  reason: string;
  note: string;
}

interface FulfillmentFormValues {
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentCarrier: string;
  fulfillmentTrackingNumber: string;
  fulfillmentTrackingUrl: string;
  fulfillmentReadyAt: string;
  fulfillmentShippedAt: string;
  fulfillmentDeliveredAt: string;
  fulfillmentNotes: string;
}

type EmailPreviewKind = "invoice" | "receipt" | "refund" | "fulfillment";

interface EmailPreviewMessage {
  kind: EmailPreviewKind;
  label: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  note: string | null;
}

interface ProductFormValues {
  name: string;
  slug: string;
  sku: string;
  description: string;
  stripeTaxCode: string;
  kind: ProductKind;
  photoId: string | null;
  basePrice: string;
  salePrice: string;
  currency: string;
  category: string;
  tags: string;
  inventoryTracked: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  allowBackorder: boolean;
  options: ProductOption[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ProductFormValues = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  stripeTaxCode: "",
  kind: "print",
  photoId: null,
  basePrice: "",
  salePrice: "",
  currency: "USD",
  category: "",
  tags: "",
  inventoryTracked: false,
  stockQuantity: "0",
  lowStockThreshold: "0",
  allowBackorder: false,
  options: [],
  isFeatured: false,
  isActive: true,
  sortOrder: "0",
};

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function centsToInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function inputToCents(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function nullablePriceToCents(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : null;
}

function adjustmentToCents(value: string) {
  const parsed = Number(value.trim() || 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function dateInputValue(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

function orderTone(status: OrderRow["status"]): ComponentProps<typeof Badge>["tone"] {
  if (status === "pending" || status === "draft") return "amber";
  if (status === "invoiced") return "blue";
  if (status === "paid" || status === "fulfilled") return "green";
  if (status === "cancelled") return "red";
  return "neutral";
}

function onlinePaymentTone(
  status: InvoiceRow["onlinePaymentStatus"],
): ComponentProps<typeof Badge>["tone"] {
  if (status === "paid") return "green";
  if (status === "pending" || status === "requires_payment") return "blue";
  if (status === "expired" || status === "failed") return "amber";
  if (status === "refunded") return "red";
  return "neutral";
}

function onlinePaymentLabel(status: InvoiceRow["onlinePaymentStatus"]) {
  if (!status) return "No hosted payment";
  return status.replace(/_/g, " ");
}

function onlinePaymentTaxModeLabel(mode: InvoiceRow["onlinePaymentTaxMode"]) {
  return mode === "stripe" ? "Stripe Tax recalculated" : "Fixed saved total";
}

function refundTone(status: RefundStatus): ComponentProps<typeof Badge>["tone"] {
  if (status === "succeeded") return "green";
  if (status === "pending") return "amber";
  if (status === "failed" || status === "cancelled") return "red";
  return "neutral";
}

function refundLabel(status: RefundStatus) {
  return status.replace(/_/g, " ");
}

function productReservedQuantity(row: ProductRow, orders: OrderRow[]) {
  if (!row.inventoryTracked) return 0;
  return orders
    .filter((order) => INVENTORY_RESERVATION_STATUSES.has(order.status))
    .flatMap((order) => order.items)
    .filter((item) => item.productId === row.id)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function productInventorySnapshot(
  row: ProductRow,
  orders: OrderRow[],
): ProductInventorySnapshot {
  if (!row.inventoryTracked) {
    return {
      reservedQuantity: 0,
      availableQuantity: 0,
      status: "not_tracked",
      label: "Tracking off",
      detail: "Inventory is not tracked for this product.",
      tone: "neutral",
    };
  }

  const reservedQuantity = productReservedQuantity(row, orders);
  const rawAvailableQuantity = row.stockQuantity - reservedQuantity;
  const availableQuantity = Math.max(0, rawAvailableQuantity);
  const detail = `${row.stockQuantity} on hand · ${reservedQuantity} reserved · ${availableQuantity} available${
    rawAvailableQuantity < 0
      ? ` · ${Math.abs(rawAvailableQuantity)} over reserved`
      : ""
  }`;
  if (rawAvailableQuantity <= 0) {
    return {
      reservedQuantity,
      availableQuantity,
      status: row.allowBackorder ? "backorder" : "sold_out",
      label: row.allowBackorder ? "Backorder" : "Sold out",
      detail,
      tone: row.allowBackorder ? "amber" : "red",
    };
  }
  if (
    row.lowStockThreshold > 0 &&
    availableQuantity <= row.lowStockThreshold
  ) {
    return {
      reservedQuantity,
      availableQuantity,
      status: "low_stock",
      label: "Low stock",
      detail,
      tone: "amber",
    };
  }
  return {
    reservedQuantity,
    availableQuantity,
    status: "in_stock",
    label: "In stock",
    detail,
    tone: "green",
  };
}

function productMatchesOpsFilter(
  row: ProductRow,
  snapshot: ProductInventorySnapshot,
  filter: ProductOpsFilter,
) {
  if (filter === "all") return true;
  if (filter === "tracking_off") return !row.inventoryTracked;
  if (filter === "needs_attention") {
    return (
      row.inventoryTracked &&
      (snapshot.status === "low_stock" ||
        snapshot.status === "sold_out" ||
        snapshot.status === "backorder")
    );
  }
  return snapshot.status === filter;
}

function successfulRefundedCents(row: OrderRow) {
  return row.refunds
    .filter((refund) => refund.status === "succeeded")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
}

function reservedRefundedCents(row: OrderRow) {
  return row.refunds
    .filter((refund) => refund.status === "succeeded" || refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
}

function paidAmountCents(row: OrderRow) {
  return row.invoice?.paidAmountCents ?? row.invoice?.amountCents ?? row.totalCents;
}

function refundableCents(row: OrderRow) {
  if (row.invoice?.status !== "paid") return 0;
  return Math.max(0, paidAmountCents(row) - reservedRefundedCents(row));
}

function pendingRefundCents(row: OrderRow) {
  return row.refunds
    .filter((refund) => refund.status === "pending")
    .reduce((sum, refund) => sum + refund.amountCents, 0);
}

function fulfillmentTone(
  status: FulfillmentStatus,
): ComponentProps<typeof Badge>["tone"] {
  if (status === "ready" || status === "shipped") return "blue";
  if (status === "delivered") return "green";
  if (status === "cancelled") return "red";
  if (status === "in_progress") return "amber";
  return "neutral";
}

function fulfillmentLabel(status: FulfillmentStatus) {
  return status.replace(/_/g, " ");
}

function canEmailFulfillment(status: FulfillmentStatus) {
  return FULFILLMENT_EMAIL_STATUSES.has(status);
}

function isOrderFilterSaved(value: OrderFilter): value is SavedOrderFilter {
  return SAVED_ORDER_FILTERS.some((filter) => filter.value === value);
}

function orderMatchesSavedFilter(row: OrderRow, filter: SavedOrderFilter) {
  if (filter === "needs_invoice") {
    return (
      OPEN_ORDER_STATUSES.has(row.status) &&
      (!row.invoice || row.invoice.status === "draft")
    );
  }
  if (filter === "awaiting_payment") {
    return Boolean(row.invoice && row.invoice.status === "issued");
  }
  if (filter === "ready_to_ship") {
    return (
      row.invoice?.status === "paid" &&
      row.fulfillmentStatus !== "shipped" &&
      row.fulfillmentStatus !== "delivered" &&
      row.fulfillmentStatus !== "cancelled"
    );
  }
  if (filter === "refunds_pending") {
    return row.refunds.some((refund) => refund.status === "pending");
  }
  if (filter === "completed") {
    return row.status === "fulfilled" || row.fulfillmentStatus === "delivered";
  }
  return !row.email;
}

function orderMatchesFilter(row: OrderRow, filter: OrderFilter) {
  if (filter === "all") return true;
  if (filter === "open") return OPEN_ORDER_STATUSES.has(row.status);
  if (isOrderFilterSaved(filter)) return orderMatchesSavedFilter(row, filter);
  return row.status === filter;
}

function orderFilterLabel(filter: OrderFilter) {
  if (filter === "all") return "All";
  if (filter === "open") return "Open";
  const saved = SAVED_ORDER_FILTERS.find((item) => item.value === filter);
  return saved?.label ?? filter.replace(/_/g, " ");
}

function orderTriageBadges(row: OrderRow): Array<{
  key: string;
  label: string;
  tone: ComponentProps<typeof Badge>["tone"];
}> {
  const badges: Array<{
    key: string;
    label: string;
    tone: ComponentProps<typeof Badge>["tone"];
  }> = [];
  if (!row.email) {
    badges.push({ key: "missing-email", label: "Missing email", tone: "amber" });
  }
  if (!row.invoice || row.invoice.status === "draft") {
    badges.push({ key: "needs-invoice", label: "Needs invoice", tone: "amber" });
  } else if (row.invoice.status === "issued") {
    badges.push({ key: "payment-due", label: "Payment due", tone: "blue" });
  } else if (row.invoice.status === "paid") {
    badges.push({ key: "paid", label: "Paid", tone: "green" });
  }
  if (row.invoice?.onlinePaymentStatus) {
    badges.push({
      key: "online-payment",
      label: `Stripe ${onlinePaymentLabel(row.invoice.onlinePaymentStatus)}`,
      tone: onlinePaymentTone(row.invoice.onlinePaymentStatus),
    });
  }
  if (row.fulfillmentStatus === "ready") {
    badges.push({ key: "ready", label: "Ready", tone: "blue" });
  } else if (row.fulfillmentStatus === "shipped") {
    badges.push({ key: "shipped", label: "Shipped", tone: "blue" });
  } else if (row.fulfillmentStatus === "delivered") {
    badges.push({ key: "delivered", label: "Delivered", tone: "green" });
  } else if (row.fulfillmentStatus === "in_progress") {
    badges.push({ key: "in-progress", label: "In progress", tone: "amber" });
  }
  if (
    (row.fulfillmentStatus === "shipped" ||
      row.fulfillmentStatus === "delivered") &&
    !row.fulfillmentTrackingNumber &&
    !row.fulfillmentTrackingUrl
  ) {
    badges.push({ key: "missing-tracking", label: "No tracking", tone: "amber" });
  }
  if (
    (row.fulfillmentStatus === "ready" ||
      row.fulfillmentStatus === "shipped" ||
      row.fulfillmentStatus === "delivered") &&
    row.invoice?.status !== "paid"
  ) {
    badges.push({
      key: "fulfillment-before-payment",
      label: "Check payment",
      tone: "amber",
    });
  }
  if (pendingRefundCents(row) > 0) {
    badges.push({
      key: "refund-pending",
      label: `Refund pending ${formatMoney(pendingRefundCents(row), row.currency)}`,
      tone: "amber",
    });
  }
  if (successfulRefundedCents(row) > 0) {
    badges.push({
      key: "refunded",
      label: `Refunded ${formatMoney(successfulRefundedCents(row), row.currency)}`,
      tone: "neutral",
    });
  }
  return badges;
}

function orderReadinessWarnings(row: OrderRow): OrderReadinessWarning[] {
  const warnings: OrderReadinessWarning[] = [];
  if (!row.email) {
    warnings.push({
      key: "missing-email",
      label: "Missing email",
      detail: "Client emails, receipts, and fulfillment updates cannot be sent yet.",
      tone: "amber",
    });
  }
  if (!row.invoice) {
    warnings.push({
      key: "missing-invoice",
      label: "Invoice needed",
      detail: "Create and send an invoice before marking this order paid.",
      tone: "amber",
    });
  } else if (row.invoice.status === "draft") {
    warnings.push({
      key: "draft-invoice",
      label: "Draft invoice",
      detail: "Issue the invoice before payment or fulfillment moves forward.",
      tone: "amber",
    });
  } else if (row.invoice.status === "issued") {
    warnings.push({
      key: "payment-due",
      label: "Payment due",
      detail: "The invoice has been issued but is not marked paid yet.",
      tone: "blue",
    });
  }
  if (
    (row.fulfillmentStatus === "ready" ||
      row.fulfillmentStatus === "shipped" ||
      row.fulfillmentStatus === "delivered") &&
    row.invoice?.status !== "paid"
  ) {
    warnings.push({
      key: "fulfillment-before-payment",
      label: "Fulfillment ahead of payment",
      detail: "Confirm payment before releasing, shipping, or delivering this order.",
      tone: "amber",
    });
  }
  if (
    (row.fulfillmentStatus === "shipped" ||
      row.fulfillmentStatus === "delivered") &&
    !row.fulfillmentTrackingNumber &&
    !row.fulfillmentTrackingUrl
  ) {
    warnings.push({
      key: "missing-tracking",
      label: "Tracking missing",
      detail: "Add a tracking number, tracking URL, or handoff reference for shipment history.",
      tone: "amber",
    });
  }
  if (
    row.fulfillmentStatus === "ready" &&
    !row.fulfillmentCarrier &&
    !row.shippingProfileLabel
  ) {
    warnings.push({
      key: "delivery-method",
      label: "Delivery method unclear",
      detail: "Add a carrier, local pickup note, or shipping profile before release.",
      tone: "neutral",
    });
  }
  return warnings;
}

function bulkStatusWarnings(status: OrderStatus, rows: OrderRow[]) {
  const warnings: string[] = [];
  if (status === "paid") {
    const missingInvoice = rows.filter(
      (row) => !row.invoice || row.invoice.status === "draft",
    ).length;
    const missingEmail = rows.filter((row) => !row.email).length;
    if (missingInvoice) {
      warnings.push(
        `${missingInvoice} selected order${missingInvoice === 1 ? "" : "s"} do not have an issued invoice.`,
      );
    }
    if (missingEmail) {
      warnings.push(
        `${missingEmail} selected order${missingEmail === 1 ? "" : "s"} are missing customer email.`,
      );
    }
  }
  if (status === "fulfilled") {
    const unpaid = rows.filter((row) => row.invoice?.status !== "paid").length;
    const notReady = rows.filter(
      (row) =>
        row.fulfillmentStatus !== "ready" &&
        row.fulfillmentStatus !== "shipped" &&
        row.fulfillmentStatus !== "delivered",
    ).length;
    const missingTracking = rows.filter(
      (row) =>
        (row.fulfillmentStatus === "shipped" ||
          row.fulfillmentStatus === "delivered") &&
        !row.fulfillmentTrackingNumber &&
        !row.fulfillmentTrackingUrl,
    ).length;
    if (unpaid) {
      warnings.push(
        `${unpaid} selected order${unpaid === 1 ? "" : "s"} are not marked paid.`,
      );
    }
    if (notReady) {
      warnings.push(
        `${notReady} selected order${notReady === 1 ? "" : "s"} have no ready, shipped, or delivered fulfillment record.`,
      );
    }
    if (missingTracking) {
      warnings.push(
        `${missingTracking} selected shipped order${missingTracking === 1 ? "" : "s"} are missing tracking details.`,
      );
    }
  }
  if (status === "cancelled") {
    const paid = rows.filter((row) => row.invoice?.status === "paid").length;
    const inFulfillment = rows.filter(
      (row) =>
        row.fulfillmentStatus === "ready" ||
        row.fulfillmentStatus === "shipped" ||
        row.fulfillmentStatus === "delivered",
    ).length;
    if (paid) {
      warnings.push(
        `${paid} selected order${paid === 1 ? "" : "s"} are paid and may need a refund record.`,
      );
    }
    if (inFulfillment) {
      warnings.push(
        `${inFulfillment} selected order${inFulfillment === 1 ? "" : "s"} already have fulfillment progress.`,
      );
    }
  }
  return warnings;
}

function bulkStatusConfirmationMessage(status: OrderStatus, rows: OrderRow[]) {
  const warnings = bulkStatusWarnings(status, rows);
  if (warnings.length === 0) return null;
  return [
    `Before marking ${rows.length} order${rows.length === 1 ? "" : "s"} ${status}:`,
    "",
    ...warnings.map((warning) => `- ${warning}`),
    "",
    "Continue with the audited bulk update?",
  ].join("\n");
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function auditActionTitle(action: string) {
  const labels: Record<string, string> = {
    "order.status.update": "Order status updated",
    "order.invoice.send": "Invoice sent",
    "order.invoice.save": "Invoice saved",
    "order.payment.receipt": "Payment recorded and receipt sent",
    "order.payment.record": "Payment recorded",
    "order.refund.email": "Refund recorded and emailed",
    "order.refund.record": "Refund recorded",
    "order.fulfillment.email": "Fulfillment update emailed",
    "order.fulfillment.update": "Fulfillment updated",
    "order.packing_checklist.update": "Packing checklist updated",
    "order.checkout.refresh": "Checkout link refreshed",
    "order.checkout.open": "Checkout link opened",
  };
  return labels[action] ?? action.replace(/\./g, " ");
}

function auditEntryDetail(row: AuditLogRow) {
  const meta = metadataRecord(row.metadata);
  const parts = [
    metadataString(meta.fromStatus) && metadataString(meta.toStatus)
      ? `${metadataString(meta.fromStatus)} -> ${metadataString(meta.toStatus)}`
      : null,
    metadataString(meta.fromOrderStatus) && metadataString(meta.toOrderStatus)
      ? `${metadataString(meta.fromOrderStatus)} -> ${metadataString(meta.toOrderStatus)}`
      : null,
    metadataString(meta.fromFulfillmentStatus) &&
    metadataString(meta.toFulfillmentStatus)
      ? `${metadataString(meta.fromFulfillmentStatus)} -> ${metadataString(meta.toFulfillmentStatus)}`
      : null,
    metadataString(meta.invoiceNumber)
      ? `Invoice ${metadataString(meta.invoiceNumber)}`
      : null,
    typeof meta.paidAmountCents === "number"
      ? `Paid ${(meta.paidAmountCents / 100).toFixed(2)}`
      : null,
    metadataString(meta.paymentMethod)
      ? `Method ${metadataString(meta.paymentMethod)}`
      : null,
    metadataString(meta.trackingNumber)
      ? `Tracking ${metadataString(meta.trackingNumber)}`
      : null,
    typeof meta.emailSent === "boolean" ? `Email ${meta.emailSent ? "sent" : "not sent"}` : null,
    typeof meta.sent === "boolean" ? `Email ${meta.sent ? "sent" : "not sent"}` : null,
    typeof meta.receiptSent === "boolean"
      ? `Receipt ${meta.receiptSent ? "sent" : "not sent"}`
      : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function auditTone(action: string): ComponentProps<typeof Badge>["tone"] {
  if (action.includes("payment") || action.includes("receipt")) return "green";
  if (action.includes("invoice") || action.includes("fulfillment")) return "blue";
  if (action.includes("refund")) return "amber";
  return "neutral";
}

function orderActivityEntries(order: OrderRow, auditRows: AuditLogRow[]) {
  const entries: ActivityEntry[] = [
    {
      id: "created",
      at: order.createdAt,
      title: "Order request received",
      detail: `${order.items.length} item${order.items.length === 1 ? "" : "s"} · ${formatMoney(
        order.totalCents,
        order.currency,
      )}`,
      tone: "neutral",
      source: "order",
    },
  ];
  if (order.invoice?.issuedAt) {
    entries.push({
      id: "invoice-issued",
      at: order.invoice.issuedAt,
      title: "Invoice issued",
      detail: order.invoice.number,
      tone: "blue",
      source: "order",
    });
  }
  if (order.invoice?.sentAt) {
    entries.push({
      id: "invoice-sent",
      at: order.invoice.sentAt,
      title: "Invoice sent to client",
      detail: order.invoice.number,
      tone: "blue",
      source: "order",
    });
  }
  if (order.invoice?.paidAt) {
    entries.push({
      id: "paid",
      at: order.invoice.paidAt,
      title: "Payment recorded",
      detail: formatMoney(
        order.invoice.paidAmountCents ?? order.invoice.amountCents,
        order.invoice.currency,
      ),
      tone: "green",
      source: "order",
    });
  }
  if (order.fulfillmentReadyAt) {
    entries.push({
      id: "ready",
      at: order.fulfillmentReadyAt,
      title: "Marked ready",
      detail: null,
      tone: "blue",
      source: "order",
    });
  }
  if (order.fulfillmentShippedAt) {
    entries.push({
      id: "shipped",
      at: order.fulfillmentShippedAt,
      title: "Marked shipped",
      detail: order.fulfillmentTrackingNumber,
      tone: "blue",
      source: "order",
    });
  }
  if (order.fulfillmentDeliveredAt) {
    entries.push({
      id: "delivered",
      at: order.fulfillmentDeliveredAt,
      title: "Marked delivered",
      detail: null,
      tone: "green",
      source: "order",
    });
  }
  for (const refund of order.refunds) {
    entries.push({
      id: `refund-${refund.id}`,
      at: refund.refundedAt ?? refund.createdAt,
      title:
        refund.status === "pending"
          ? "Refund pending"
          : refund.status === "succeeded"
            ? "Refund recorded"
            : `Refund ${refund.status}`,
      detail: formatMoney(refund.amountCents, refund.currency),
      tone: refundTone(refund.status),
      source: "order",
    });
  }
  for (const row of auditRows) {
    entries.push({
      id: `audit-${row.id}`,
      at: row.createdAt,
      title: auditActionTitle(row.action),
      detail: auditEntryDetail(row),
      tone: auditTone(row.action),
      source: "audit",
    });
  }
  return entries.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function selectedOrdersCsv(rows: OrderRow[]) {
  const header = [
    "Order ID",
    "Customer",
    "Email",
    "Status",
    "Fulfillment",
    "Invoice",
    "Payment",
    "Total",
    "Currency",
    "Received",
  ];
  const body = rows.map((row) => [
    row.id,
    row.clientName ?? "",
    row.email ?? "",
    row.status,
    fulfillmentLabel(row.fulfillmentStatus),
    row.invoice?.number ?? "",
    row.invoice?.status ?? "",
    (row.totalCents / 100).toFixed(2),
    row.currency,
    row.createdAt,
  ]);
  return [header, ...body]
    .map((line) => line.map((value) => csvCell(value)).join(","))
    .join("\n");
}

function shortRef(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function orderItemTitle(item: OrderRow["items"][number]) {
  if (!item.description) return "Product";
  if (item.options.length === 0) return item.description;
  return item.description.split(" — ")[0] || item.description;
}

function optionLine(option: SelectedProductOption, currency: string) {
  const delta =
    option.priceDeltaCents === 0
      ? ""
      : ` (${option.priceDeltaCents > 0 ? "+" : "-"}${formatMoney(
          Math.abs(option.priceDeltaCents),
          currency,
        )})`;
  return `${option.optionName}: ${option.valueLabel}${delta}`;
}

function itemSearchText(item: OrderRow["items"][number], currency: string) {
  return [
    orderItemTitle(item),
    item.description,
    ...item.options.map((option) => optionLine(option, currency)),
  ]
    .filter(Boolean)
    .join(" ");
}

function orderSearchText(row: OrderRow) {
  return [
    row.id,
    row.clientName,
    row.email,
    row.clientPhone,
    row.status,
    row.invoice?.number,
    row.invoice?.status,
    row.invoice?.paymentMethod,
    row.invoice?.paymentReference,
    row.invoice?.onlinePaymentStatus,
    row.invoice?.onlinePaymentSessionId,
    row.invoice?.onlinePaymentIntentId,
    row.fulfillmentStatus,
    row.fulfillmentCarrier,
    row.fulfillmentTrackingNumber,
    ...row.refunds.flatMap((refund) => [
      refund.status,
      refund.provider,
      refund.providerRefundId,
      refund.providerError,
      refund.method,
      refund.reference,
      refund.reason,
      refund.note,
    ]),
    row.clientNotes,
    ...row.items.map((item) => itemSearchText(item, row.currency)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function orderSummary(row: OrderRow) {
  const lines = row.items.flatMap((item) => {
    const head = `- ${item.quantity} x ${orderItemTitle(item)} @ ${formatMoney(
      item.unitPriceCents,
      row.currency,
    )} = ${formatMoney(item.lineTotalCents, row.currency)}`;
    const details = [
      item.stripeTaxCode ? `  Tax code: ${item.stripeTaxCode}` : null,
      ...item.options.map((option) => `  ${optionLine(option, row.currency)}`),
    ].filter(Boolean) as string[];
    if (details.length === 0) return [head];
    return [head, ...details];
  });
  return [
    `Order ${row.id}`,
    `Status: ${row.status}`,
    `Customer: ${row.clientName || "Unknown"}`,
    `Email: ${row.email || "n/a"}`,
    `Phone: ${row.clientPhone || "n/a"}`,
    "",
    "Items:",
    ...(lines.length ? lines : ["- No items"]),
    "",
    `Subtotal: ${formatMoney(row.subtotalCents, row.currency)}`,
    row.discountCents > 0
      ? `Discount${row.promoCode ? ` (${row.promoCode})` : ""}: -${formatMoney(
          row.discountCents,
          row.currency,
        )}`
      : null,
    `Tax: ${formatMoney(row.taxCents, row.currency)}`,
    `Shipping${row.shippingProfileLabel ? ` (${row.shippingProfileLabel})` : ""}: ${formatMoney(
      row.shippingCents,
      row.currency,
    )}`,
    `Total: ${formatMoney(row.totalCents, row.currency)}`,
    row.invoice ? `Invoice: ${row.invoice.number} (${row.invoice.status})` : null,
    row.invoice?.paidAt
      ? `Paid: ${formatMoney(row.invoice.paidAmountCents ?? row.totalCents, row.currency)} on ${formatDate(row.invoice.paidAt)}`
      : null,
    row.invoice?.paymentMethod ? `Payment method: ${row.invoice.paymentMethod}` : null,
    row.invoice?.paymentReference
      ? `Payment reference: ${row.invoice.paymentReference}`
      : null,
    row.invoice?.onlinePaymentStatus
      ? `Hosted payment: ${onlinePaymentLabel(row.invoice.onlinePaymentStatus)}`
      : null,
    row.invoice?.onlinePaymentProvider
      ? `Payment link tax mode: ${onlinePaymentTaxModeLabel(row.invoice.onlinePaymentTaxMode)}`
      : null,
    row.refunds.length
      ? `Refunded: ${formatMoney(successfulRefundedCents(row), row.currency)}`
      : null,
    ...row.refunds.map(
      (refund) =>
        `Refund ${refundLabel(refund.status)}: ${formatMoney(
          refund.amountCents,
          refund.currency,
        )}${refund.reference ? ` (${refund.reference})` : ""}${
          refund.providerError ? ` - ${refund.providerError}` : ""
        }`,
    ),
    row.invoice?.onlinePaymentSessionId
      ? `Stripe session: ${row.invoice.onlinePaymentSessionId}`
      : null,
    row.invoice?.onlinePaymentIntentId
      ? `Stripe payment intent: ${row.invoice.onlinePaymentIntentId}`
      : null,
    `Fulfillment: ${fulfillmentLabel(row.fulfillmentStatus)}`,
    row.fulfillmentCarrier ? `Carrier: ${row.fulfillmentCarrier}` : null,
    row.fulfillmentTrackingNumber ? `Tracking: ${row.fulfillmentTrackingNumber}` : null,
    row.fulfillmentTrackingUrl ? `Tracking URL: ${row.fulfillmentTrackingUrl}` : null,
    row.clientNotes ? `Notes: ${row.clientNotes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function photoUrl(photo: PhotoDTO | null | undefined) {
  if (!photo) return null;
  const pick =
    photo.variants.find(
      (variant) => variant.format === "webp" && variant.sizeBucket === "small",
    ) ??
    photo.variants.find((variant) => variant.format === "webp") ??
    photo.variants[0];
  return pick?.url ?? null;
}

function toForm(product: ProductRow): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description ?? "",
    stripeTaxCode: product.stripeTaxCode ?? "",
    kind: product.kind,
    photoId: product.photoId,
    basePrice: centsToInput(product.basePriceCents),
    salePrice: centsToInput(product.salePriceCents),
    currency: product.currency,
    category: product.category ?? "",
    tags: product.tags.join(", "),
    inventoryTracked: product.inventoryTracked,
    stockQuantity: String(product.stockQuantity),
    lowStockThreshold: String(product.lowStockThreshold),
    allowBackorder: product.allowBackorder,
    options: normalizeProductOptions(product.options),
    isFeatured: product.isFeatured,
    isActive: product.isActive,
    sortOrder: String(product.sortOrder),
  };
}

function toPayload(form: ProductFormValues) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    sku: form.sku.trim(),
    description: form.description.trim() || null,
    stripeTaxCode: form.stripeTaxCode.trim() || null,
    kind: form.kind,
    photoId: form.photoId,
    basePriceCents: inputToCents(form.basePrice),
    salePriceCents: nullablePriceToCents(form.salePrice),
    currency: (form.currency.trim() || "USD").toUpperCase(),
    category: form.category.trim() || null,
    inventoryTracked: form.inventoryTracked,
    stockQuantity: Math.round(Number(form.stockQuantity) || 0),
    lowStockThreshold: Math.max(0, Math.round(Number(form.lowStockThreshold) || 0)),
    allowBackorder: form.allowBackorder,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    options: normalizeProductOptions(form.options),
    isFeatured: form.isFeatured,
    isActive: form.isActive,
    sortOrder: Number.isFinite(Number(form.sortOrder)) ? Number(form.sortOrder) : 0,
  };
}

function ProductPhotoPicker({
  photos,
  value,
  onChange,
}: {
  photos: PhotoDTO[];
  value: string | null;
  onChange: (photoId: string | null) => void;
}) {
  const selected = photos.find((photo) => photo.id === value) ?? null;
  return (
    <div className="space-y-2">
      <Select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">No product image</option>
        {photos.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {photo.headline || photo.altText || photo.caption || photo.id}
          </option>
        ))}
      </Select>
      {selected ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-[hsl(var(--muted))]">
            {photoUrl(selected) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl(selected)!}
                alt={selected.altText ?? ""}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <p className="min-w-0 truncate text-sm text-[hsl(var(--muted-foreground))]">
            {selected.headline || selected.altText || selected.caption || selected.id}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function newProductOptionValue(label = "Choice"): ProductOptionValue {
  return {
    id: createStoreOptionId("value"),
    label,
    priceDeltaCents: 0,
    inventoryTracked: false,
    stockQuantity: 0,
    lowStockThreshold: 0,
    allowBackorder: false,
  };
}

function newProductOption(): ProductOption {
  return {
    id: createStoreOptionId("option"),
    name: "",
    required: true,
    values: [newProductOptionValue()],
  };
}

function ProductOptionsEditor({
  value,
  currency,
  onChange,
}: {
  value: ProductOption[];
  currency: string;
  onChange: (options: ProductOption[]) => void;
}) {
  const setOption = (optionIndex: number, next: ProductOption) => {
    onChange(value.map((option, index) => (index === optionIndex ? next : option)));
  };

  const removeOption = (optionIndex: number) => {
    onChange(value.filter((_, index) => index !== optionIndex));
  };

  const setChoice = (
    optionIndex: number,
    choiceIndex: number,
    next: ProductOptionValue,
  ) => {
    const option = value[optionIndex];
    if (!option) return;
    setOption(optionIndex, {
      ...option,
      values: option.values.map((choice, index) =>
        index === choiceIndex ? next : choice,
      ),
    });
  };

  const removeChoice = (optionIndex: number, choiceIndex: number) => {
    const option = value[optionIndex];
    if (!option) return;
    setOption(optionIndex, {
      ...option,
      values: option.values.filter((_, index) => index !== choiceIndex),
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Options and choices</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Add choices like size, finish, license, or framing. Price adjustments use{" "}
            {currency || "USD"}.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, newProductOption()])}
        >
          <Plus className="h-4 w-4" />
          Add option
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-[hsl(var(--muted-foreground))]">
          No product options. Shoppers can add this product directly to cart.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((option, optionIndex) => (
            <div key={option.id} className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Field label="Option name" htmlFor={`product-option-${option.id}`}>
                  <Input
                    id={`product-option-${option.id}`}
                    value={option.name}
                    onChange={(event) =>
                      setOption(optionIndex, { ...option, name: event.target.value })
                    }
                    placeholder="Size"
                  />
                </Field>
                <label className="inline-flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={option.required}
                    onChange={(event) =>
                      setOption(optionIndex, {
                        ...option,
                        required: event.target.checked,
                      })
                    }
                  />
                  Required
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeOption(optionIndex)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>

              <div className="space-y-2">
                {option.values.map((choice, choiceIndex) => (
                  <div
                    key={choice.id}
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem_6.5rem_auto_auto_auto]"
                  >
                    <Input
                      value={choice.label}
                      onChange={(event) =>
                        setChoice(optionIndex, choiceIndex, {
                          ...choice,
                          label: event.target.value,
                        })
                      }
                      placeholder="11x14"
                      aria-label="Choice label"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={centsToInput(choice.priceDeltaCents)}
                      onChange={(event) =>
                        setChoice(optionIndex, choiceIndex, {
                          ...choice,
                          priceDeltaCents: adjustmentToCents(event.target.value),
                        })
                      }
                      placeholder="0.00"
                      aria-label="Price adjustment"
                    />
                    <Input
                      type="number"
                      value={String(choice.stockQuantity)}
                      onChange={(event) =>
                        setChoice(optionIndex, choiceIndex, {
                          ...choice,
                          stockQuantity: Math.round(Number(event.target.value) || 0),
                        })
                      }
                      placeholder="Stock"
                      aria-label="Choice stock quantity"
                      disabled={!choice.inventoryTracked}
                    />
                    <Input
                      type="number"
                      min="0"
                      value={String(choice.lowStockThreshold)}
                      onChange={(event) =>
                        setChoice(optionIndex, choiceIndex, {
                          ...choice,
                          lowStockThreshold: Math.max(
                            0,
                            Math.round(Number(event.target.value) || 0),
                          ),
                        })
                      }
                      placeholder="Low"
                      aria-label="Choice low stock threshold"
                      disabled={!choice.inventoryTracked}
                    />
                    <label className="inline-flex items-center gap-2 rounded border px-2 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={choice.inventoryTracked}
                        onChange={(event) =>
                          setChoice(optionIndex, choiceIndex, {
                            ...choice,
                            inventoryTracked: event.target.checked,
                          })
                        }
                      />
                      Stock
                    </label>
                    <label className="inline-flex items-center gap-2 rounded border px-2 py-2 text-xs">
                      <input
                        type="checkbox"
                        checked={choice.allowBackorder}
                        onChange={(event) =>
                          setChoice(optionIndex, choiceIndex, {
                            ...choice,
                            allowBackorder: event.target.checked,
                          })
                        }
                        disabled={!choice.inventoryTracked}
                      />
                      Backorder
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeChoice(optionIndex, choiceIndex)}
                      disabled={option.values.length <= 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOption(optionIndex, {
                      ...option,
                      values: [...option.values, newProductOptionValue()],
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add choice
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductModal({
  title,
  initial,
  photos,
  onClose,
  onSubmit,
}: {
  title: string;
  initial: ProductFormValues;
  photos: PhotoDTO[];
  onClose: () => void;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [slugEdited, setSlugEdited] = useState(Boolean(initial.slug));
  const [skuEdited, setSkuEdited] = useState(Boolean(initial.sku));
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="product-name">
            <Input
              id="product-name"
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                const slug = slugify(name);
                setForm((current) => ({
                  ...current,
                  name,
                  slug: slugEdited ? current.slug : slug,
                  sku: skuEdited ? current.sku : slug.toUpperCase(),
                }));
              }}
              required
            />
          </Field>
          <Field label="Kind" htmlFor="product-kind">
            <Select
              id="product-kind"
              value={form.kind}
              onChange={(event) =>
                setForm({ ...form, kind: event.target.value as ProductKind })
              }
            >
              <option value="print">Print</option>
              <option value="digital">Digital</option>
              <option value="bundle">Bundle</option>
            </Select>
          </Field>
          <Field label="Slug" htmlFor="product-slug">
            <Input
              id="product-slug"
              value={form.slug}
              onChange={(event) => {
                setForm({ ...form, slug: event.target.value });
                setSlugEdited(event.target.value.trim() !== "");
              }}
              required
            />
          </Field>
          <Field label="SKU" htmlFor="product-sku">
            <Input
              id="product-sku"
              value={form.sku}
              onChange={(event) => {
                setForm({ ...form, sku: event.target.value });
                setSkuEdited(event.target.value.trim() !== "");
              }}
              required
            />
          </Field>
          <Field label="Price" htmlFor="product-price">
            <Input
              id="product-price"
              type="number"
              min="0"
              step="0.01"
              value={form.basePrice}
              onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
              placeholder="89.00"
            />
          </Field>
          <Field label="Sale price" htmlFor="product-sale-price">
            <Input
              id="product-sale-price"
              type="number"
              min="0"
              step="0.01"
              value={form.salePrice}
              onChange={(event) => setForm({ ...form, salePrice: event.target.value })}
              placeholder="Optional"
            />
          </Field>
          <Field label="Currency" htmlFor="product-currency">
            <Input
              id="product-currency"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
              maxLength={3}
            />
          </Field>
          <Field label="Display order" htmlFor="product-sort-order">
            <Input
              id="product-sort-order"
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm({ ...form, sortOrder: event.target.value })}
            />
          </Field>
          <Field label="Category" htmlFor="product-category">
            <Input
              id="product-category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Sunset"
            />
          </Field>
          <Field
            label="Stripe tax code"
            htmlFor="product-stripe-tax-code"
            hint="Optional. Used by Stripe Tax when hosted cart checkout is enabled."
          >
            <Input
              id="product-stripe-tax-code"
              value={form.stripeTaxCode}
              onChange={(event) =>
                setForm({ ...form, stripeTaxCode: event.target.value })
              }
              placeholder="txcd_..."
              autoComplete="off"
            />
          </Field>
          <Field
            label="Tags"
            htmlFor="product-tags"
            hint="Comma-separated labels for filtering/tag cloud."
          >
            <Input
              id="product-tags"
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder="Abstract, Nature, Wedding"
            />
          </Field>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Inventory</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Track product-level stock. Option choices can also track stock below.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.inventoryTracked}
                onChange={(event) =>
                  setForm({ ...form, inventoryTracked: event.target.checked })
                }
              />
              Track inventory
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Stock quantity" htmlFor="product-stock-quantity">
              <Input
                id="product-stock-quantity"
                type="number"
                value={form.stockQuantity}
                onChange={(event) =>
                  setForm({ ...form, stockQuantity: event.target.value })
                }
                disabled={!form.inventoryTracked}
              />
            </Field>
            <Field label="Low stock threshold" htmlFor="product-low-stock-threshold">
              <Input
                id="product-low-stock-threshold"
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(event) =>
                  setForm({ ...form, lowStockThreshold: event.target.value })
                }
                disabled={!form.inventoryTracked}
              />
            </Field>
            <label className="inline-flex items-center gap-2 self-end pb-2 text-sm">
              <input
                type="checkbox"
                checked={form.allowBackorder}
                onChange={(event) =>
                  setForm({ ...form, allowBackorder: event.target.checked })
                }
                disabled={!form.inventoryTracked}
              />
              Allow backorder
            </label>
          </div>
        </div>
        <Field label="Product image">
          <ProductPhotoPicker
            photos={photos}
            value={form.photoId}
            onChange={(photoId) => setForm({ ...form, photoId })}
          />
        </Field>
        <Field label="Description" htmlFor="product-description">
          <Textarea
            id="product-description"
            rows={4}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>
        <ProductOptionsEditor
          value={form.options}
          currency={form.currency}
          onChange={(options) => setForm({ ...form, options })}
        />
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Active
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(event) =>
                setForm({ ...form, isFeatured: event.target.checked })
              }
            />
            Featured
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EmailPreviewModal({
  preview,
  onClose,
}: {
  preview: EmailPreviewMessage;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      title={preview.label}
      className="w-[min(94vw,58rem)]"
    >
      <div className="space-y-4">
        <div className="grid gap-3 rounded-lg border bg-[hsl(var(--muted))] p-3 text-sm sm:grid-cols-[8rem_1fr]">
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            To
          </span>
          <span className="break-words">{preview.to}</span>
          <span className="font-medium text-[hsl(var(--muted-foreground))]">
            Subject
          </span>
          <span className="break-words">{preview.subject}</span>
        </div>
        {preview.note && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200">
            {preview.note}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">HTML preview</h3>
            <iframe
              title={`${preview.label} HTML preview`}
              srcDoc={preview.html}
              sandbox=""
              className="h-[32rem] w-full rounded-lg border bg-white"
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Plain text</h3>
            <pre className="h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed">
              {preview.text}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function OrderDetailModal({
  order,
  saving,
  onClose,
  onCopy,
  onStatusChange,
  onInvoiceSubmit,
  onPaymentSubmit,
  onRefundSubmit,
  onFulfillmentSubmit,
  onPackingChecklistSubmit,
  onInvoiceLinkAction,
  onCheckoutLinkAction,
  onStatusLinkAction,
  onRefreshCheckout,
  auditRows,
  auditLoading,
}: {
  order: OrderRow;
  saving: boolean;
  auditRows: AuditLogRow[];
  auditLoading: boolean;
  onClose: () => void;
  onCopy: (order: OrderRow) => void;
  onStatusChange: (status: OrderStatus) => Promise<void>;
  onInvoiceSubmit: (values: InvoiceFormValues, sendEmail: boolean) => Promise<void>;
  onPaymentSubmit: (values: PaymentFormValues, sendReceipt: boolean) => Promise<void>;
  onRefundSubmit: (values: RefundFormValues, sendEmail: boolean) => Promise<void>;
  onFulfillmentSubmit: (
    values: FulfillmentFormValues,
    sendEmail: boolean,
  ) => Promise<void>;
  onPackingChecklistSubmit: (
    items: Array<{ itemId: string; checked: boolean }>,
  ) => Promise<void>;
  onInvoiceLinkAction: (order: OrderRow, action: "open" | "copy") => Promise<void>;
  onCheckoutLinkAction: (order: OrderRow, action: "open" | "copy") => Promise<void>;
  onStatusLinkAction: (order: OrderRow, action: "open" | "copy") => Promise<void>;
  onRefreshCheckout: (order: OrderRow) => Promise<void>;
}) {
  const { toast } = useToast();
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormValues>({
    dueAt: "",
    notes: "",
    paymentInstructions: "",
  });
  const [paymentForm, setPaymentForm] = useState<PaymentFormValues>({
    paidAt: "",
    paidAmount: "",
    paymentMethod: "",
    paymentReference: "",
    paymentNote: "",
  });
  const [refundForm, setRefundForm] = useState<RefundFormValues>({
    provider: "manual",
    refundedAt: "",
    amount: "",
    method: "",
    reference: "",
    reason: "",
    note: "",
  });
  const [fulfillmentForm, setFulfillmentForm] = useState<FulfillmentFormValues>({
    fulfillmentStatus: "unfulfilled",
    fulfillmentCarrier: "",
    fulfillmentTrackingNumber: "",
    fulfillmentTrackingUrl: "",
    fulfillmentReadyAt: "",
    fulfillmentShippedAt: "",
    fulfillmentDeliveredAt: "",
    fulfillmentNotes: "",
  });
  const [packingCheckedIds, setPackingCheckedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [preview, setPreview] = useState<EmailPreviewMessage | null>(null);
  const [previewing, setPreviewing] = useState<EmailPreviewKind | null>(null);
  const activity = useMemo(
    () => orderActivityEntries(order, auditRows),
    [order, auditRows],
  );
  const savedPackingByItemId = useMemo(
    () => new Map(order.packingChecklist.map((entry) => [entry.itemId, entry])),
    [order.packingChecklist],
  );
  const savedPackedIds = useMemo(
    () =>
      new Set(
        order.packingChecklist
          .filter((entry) => entry.checked)
          .map((entry) => entry.itemId),
      ),
    [order.packingChecklist],
  );
  const readinessWarnings = orderReadinessWarnings(order);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedOptionCount = order.items.reduce(
    (sum, item) => sum + item.options.length,
    0,
  );
  const invoicePaid = order.invoice?.status === "paid";
  const stripeRefundAvailable =
    invoicePaid &&
    order.invoice?.onlinePaymentProvider === "stripe" &&
    Boolean(order.invoice.onlinePaymentIntentId);
  const refundedCents = successfulRefundedCents(order);
  const reservedRefundCents = reservedRefundedCents(order);
  const remainingRefundCents = refundableCents(order);
  const canRecordRefund =
    invoicePaid && remainingRefundCents > 0 && inputToCents(refundForm.amount) > 0;
  const canRefreshCheckout = order.invoice?.status === "issued";
  const fulfillmentCanEmail =
    Boolean(order.email) && canEmailFulfillment(fulfillmentForm.fulfillmentStatus);
  const packedItemCount = order.items.filter((item) =>
    packingCheckedIds.has(item.id),
  ).length;
  const packingChecklistDirty = order.items.some(
    (item) => packingCheckedIds.has(item.id) !== savedPackedIds.has(item.id),
  );
  const nextStatus: OrderStatus | null =
    order.status === "draft" ||
    order.status === "pending" ||
    order.status === "invoiced"
      ? "paid"
      : order.status === "paid"
        ? "fulfilled"
        : null;
  useEffect(() => {
    setInvoiceForm({
      dueAt: dateInputValue(order.invoice?.dueAt),
      notes: order.invoice?.notes ?? "",
      paymentInstructions: order.invoice?.paymentInstructions ?? "",
    });
    setPaymentForm({
      paidAt: dateInputValue(order.invoice?.paidAt ?? new Date().toISOString()),
      paidAmount: centsToInput(order.invoice?.paidAmountCents ?? order.totalCents),
      paymentMethod: order.invoice?.paymentMethod ?? "",
      paymentReference: order.invoice?.paymentReference ?? "",
      paymentNote: order.invoice?.paymentNote ?? "",
    });
    setRefundForm({
      provider: stripeRefundAvailable ? "stripe" : "manual",
      refundedAt: dateInputValue(new Date().toISOString()),
      amount: centsToInput(refundableCents(order)),
      method: "",
      reference: "",
      reason: "",
      note: "",
    });
    setFulfillmentForm({
      fulfillmentStatus: order.fulfillmentStatus,
      fulfillmentCarrier: order.fulfillmentCarrier ?? "",
      fulfillmentTrackingNumber: order.fulfillmentTrackingNumber ?? "",
      fulfillmentTrackingUrl: order.fulfillmentTrackingUrl ?? "",
      fulfillmentReadyAt: dateInputValue(order.fulfillmentReadyAt),
      fulfillmentShippedAt: dateInputValue(order.fulfillmentShippedAt),
      fulfillmentDeliveredAt: dateInputValue(order.fulfillmentDeliveredAt),
      fulfillmentNotes: order.fulfillmentNotes ?? "",
    });
    setPackingCheckedIds(savedPackedIds);
  }, [
    order.id,
    order.invoice,
    order.totalCents,
    order,
    savedPackedIds,
    stripeRefundAvailable,
  ]);

  const submitFulfillmentStatus = (status: FulfillmentStatus, sendEmail: boolean) => {
    const values = { ...fulfillmentForm, fulfillmentStatus: status };
    setFulfillmentForm(values);
    return onFulfillmentSubmit(values, sendEmail);
  };

  const savePackingChecklist = () =>
    onPackingChecklistSubmit(
      order.items.map((item) => ({
        itemId: item.id,
        checked: packingCheckedIds.has(item.id),
      })),
    );

  const previewEmail = async (kind: EmailPreviewKind) => {
    setPreviewing(kind);
    try {
      const body =
        kind === "invoice"
          ? {
              kind,
              invoice: {
                dueAt: invoiceForm.dueAt || null,
                notes: invoiceForm.notes.trim() || null,
                paymentInstructions:
                  invoiceForm.paymentInstructions.trim() || null,
              },
            }
          : kind === "receipt"
            ? {
                kind,
                payment: {
                  paidAt: paymentForm.paidAt || null,
                  paidAmountCents: inputToCents(paymentForm.paidAmount),
                  paymentMethod: paymentForm.paymentMethod.trim() || null,
                  paymentReference: paymentForm.paymentReference.trim() || null,
                  paymentNote: paymentForm.paymentNote.trim() || null,
                },
              }
            : kind === "refund"
              ? {
                  kind,
                  refund: {
                    amountCents: inputToCents(refundForm.amount),
                    status: "succeeded",
                    provider: refundForm.provider,
                    method:
                      refundForm.provider === "stripe"
                        ? null
                        : refundForm.method.trim() || null,
                    reference:
                      refundForm.provider === "stripe"
                        ? null
                        : refundForm.reference.trim() || null,
                    reason: refundForm.reason.trim() || null,
                    note: refundForm.note.trim() || null,
                    refundedAt: refundForm.refundedAt || null,
                  },
                }
              : {
                  kind,
                  fulfillment: {
                    fulfillmentStatus: fulfillmentForm.fulfillmentStatus,
                    fulfillmentCarrier:
                      fulfillmentForm.fulfillmentCarrier.trim() || null,
                    fulfillmentTrackingNumber:
                      fulfillmentForm.fulfillmentTrackingNumber.trim() || null,
                    fulfillmentTrackingUrl:
                      fulfillmentForm.fulfillmentTrackingUrl.trim() || null,
                    fulfillmentReadyAt: fulfillmentForm.fulfillmentReadyAt || null,
                    fulfillmentShippedAt:
                      fulfillmentForm.fulfillmentShippedAt || null,
                    fulfillmentDeliveredAt:
                      fulfillmentForm.fulfillmentDeliveredAt || null,
                    fulfillmentNotes: fulfillmentForm.fulfillmentNotes.trim() || null,
                  },
                };
      const res = await api.post<{ data: EmailPreviewMessage }>(
        `/api/v1/admin/orders/${order.id}/email-preview`,
        body,
      );
      setPreview(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setPreviewing(null);
    }
  };

  return (
    <>
      <Modal open onClose={onClose} title="Order request" className="w-[min(94vw,52rem)]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
              {order.id}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {order.clientName || order.email || "Unknown customer"}
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Received {formatDate(order.createdAt)}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {itemCount} item{itemCount === 1 ? "" : "s"}
              {selectedOptionCount > 0
                ? ` · ${selectedOptionCount} selected option${selectedOptionCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge tone={orderTone(order.status)} className="capitalize">
              {order.status}
            </Badge>
            <Badge
              tone={fulfillmentTone(order.fulfillmentStatus)}
              className="capitalize"
            >
              {fulfillmentLabel(order.fulfillmentStatus)}
            </Badge>
            {orderTriageBadges(order).map((badge) => (
              <Badge key={badge.key} tone={badge.tone} className="capitalize">
                {badge.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Email
            </p>
            <p>{order.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Phone
            </p>
            <p>{order.clientPhone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Payment
            </p>
            <p>{order.paymentProvider || "manual"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Last updated
            </p>
            <p>{formatDate(order.updatedAt)}</p>
          </div>
          {order.clientNotes && (
            <div className="sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Notes
              </p>
              <p className="whitespace-pre-wrap">{order.clientNotes}</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-medium">Readiness</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Quick checks before payment, packing, or shipment.
              </p>
            </div>
            <Badge tone={readinessWarnings.length ? "amber" : "green"}>
              {readinessWarnings.length
                ? `${readinessWarnings.length} check${readinessWarnings.length === 1 ? "" : "s"}`
                : "Ready"}
            </Badge>
          </div>
          <div className="mt-3 space-y-2">
            {readinessWarnings.length === 0 ? (
              <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950/40 dark:text-green-300">
                No readiness warnings for this order.
              </p>
            ) : (
              readinessWarnings.map((warning) => (
                <div
                  key={warning.key}
                  className="flex gap-2 rounded-md bg-[hsl(var(--muted))] p-3 text-sm"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{warning.label}</p>
                      <Badge tone={warning.tone}>Check</Badge>
                    </div>
                    <p className="mt-1 text-[hsl(var(--muted-foreground))]">
                      {warning.detail}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-medium">Activity timeline</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Order milestones plus admin audit entries for this request.
              </p>
            </div>
            {auditLoading && (
              <Badge tone="neutral" className="gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading audit
              </Badge>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No activity yet.
              </p>
            ) : (
              activity.slice(0, 14).map((entry) => (
                <div
                  key={entry.id}
                  className="grid gap-2 rounded-md border bg-[hsl(var(--muted))] p-3 text-sm sm:grid-cols-[9rem_1fr]"
                >
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {formatDate(entry.at)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{entry.title}</p>
                      <Badge tone={entry.tone}>
                        {entry.source === "audit" ? "Audit" : "Milestone"}
                      </Badge>
                    </div>
                    {entry.detail && (
                      <p className="break-words text-[hsl(var(--muted-foreground))]">
                        {entry.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-[hsl(var(--muted))] text-left text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <p className="font-medium">{orderItemTitle(item)}</p>
                      {item.options.length > 0 && (
                        <div className="grid gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                          {item.options.map((option) => (
                            <span key={`${item.id}-${option.optionId}`}>
                              {optionLine(option, order.currency)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    {formatMoney(item.unitPriceCents, order.currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatMoney(item.lineTotalCents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="flex items-center gap-2 font-medium">
                <ClipboardCheck className="h-4 w-4" />
                Packing checklist
              </h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Saved checklist for packing, pickup, and shipment prep.
              </p>
            </div>
            <Badge
              tone={
                order.items.length > 0 && packedItemCount === order.items.length
                  ? "green"
                  : packingChecklistDirty
                    ? "amber"
                    : "neutral"
              }
            >
              {packedItemCount}/{order.items.length} packed
            </Badge>
          </div>
          <div className="space-y-2">
            {order.items.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No items to pack.
              </p>
            ) : (
              order.items.map((item) => (
                <label
                  key={`pack-${item.id}`}
                  className="flex gap-3 rounded-md bg-[hsl(var(--muted))] p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={packingCheckedIds.has(item.id)}
                    disabled={saving}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setPackingCheckedIds((current) => {
                        const next = new Set(current);
                        if (checked) next.add(item.id);
                        else next.delete(item.id);
                        return next;
                      });
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {item.quantity} × {orderItemTitle(item)}
                    </span>
                    {item.options.length > 0 && (
                      <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                        {item.options
                          .map((option) => optionLine(option, order.currency))
                          .join(" · ")}
                      </span>
                    )}
                    {savedPackingByItemId.get(item.id)?.checkedAt && (
                      <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                        Packed{" "}
                        {formatDate(
                          savedPackingByItemId.get(item.id)?.checkedAt ?? "",
                        )}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {packingChecklistDirty
                ? "Unsaved packing changes"
                : "Packing checklist is saved"}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || order.items.length === 0}
                onClick={() =>
                  window.open(
                    `/admin/store/orders/${encodeURIComponent(
                      order.id,
                    )}/packing-slip`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <ExternalLink className="h-4 w-4" />
                Packing slip
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || order.items.length === 0}
                onClick={() =>
                  setPackingCheckedIds(new Set(order.items.map((item) => item.id)))
                }
              >
                Mark all packed
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving || order.items.length === 0}
                onClick={() => setPackingCheckedIds(new Set())}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving || !packingChecklistDirty}
                onClick={savePackingChecklist}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save checklist
              </Button>
            </div>
          </div>
          <div className="grid gap-2 rounded-md border p-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
            <span>
              Contact: {order.email || order.clientPhone || "No contact saved"}
            </span>
            <span>
              Method: {order.shippingProfileLabel || order.fulfillmentCarrier || "Not set"}
            </span>
            <span>
              Tracking:{" "}
              {order.fulfillmentTrackingNumber ||
                (order.fulfillmentTrackingUrl ? "Tracking URL saved" : "Not set")}
            </span>
          </div>
          {order.fulfillmentNotes && (
            <p className="whitespace-pre-wrap rounded-md bg-[hsl(var(--muted))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
              {order.fulfillmentNotes}
            </p>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Order status" htmlFor="order-status">
            <Select
              id="order-status"
              value={order.status}
              disabled={saving}
              onChange={(event) => onStatusChange(event.target.value as OrderStatus)}
            >
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="invoiced">Invoiced</option>
              <option value="paid">Paid</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            {nextStatus && (
              <Button
                type="button"
                variant="default"
                disabled={saving}
                onClick={() => onStatusChange(nextStatus)}
              >
                <PackageCheck className="h-4 w-4" />
                Mark {nextStatus}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onCopy(order)}>
              <Copy className="h-4 w-4" />
              Copy summary
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => previewEmail("invoice")}
            >
              {previewing === "invoice" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview email
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onStatusLinkAction(order, "open")}
            >
              <ExternalLink className="h-4 w-4" />
              Open status
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onStatusLinkAction(order, "copy")}
            >
              <LinkIcon className="h-4 w-4" />
              Copy status link
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-medium">Invoice</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Save invoice details, then send a secure invoice link by email.
              </p>
            </div>
            {order.invoice ? (
              <Badge
                tone={
                  order.invoice.status === "paid"
                    ? "green"
                    : order.invoice.status === "void"
                      ? "red"
                      : "blue"
                }
              >
                {order.invoice.number} · {order.invoice.status}
              </Badge>
            ) : (
              <Badge tone="neutral">No invoice yet</Badge>
            )}
          </div>

          {order.invoice && (
            <div className="grid gap-2 rounded-md bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-5">
              <span>Created {formatDate(order.invoice.createdAt)}</span>
              <span>
                Issued{" "}
                {order.invoice.issuedAt ? formatDate(order.invoice.issuedAt) : "—"}
              </span>
              <span>
                Sent {order.invoice.sentAt ? formatDate(order.invoice.sentAt) : "—"}
              </span>
              <span>
                Paid {order.invoice.paidAt ? formatDate(order.invoice.paidAt) : "—"}
              </span>
              <span>
                Receipt{" "}
                {order.invoice.receiptSentAt
                  ? formatDate(order.invoice.receiptSentAt)
                  : "—"}
              </span>
            </div>
          )}

          {order.invoice?.onlinePaymentProvider && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Hosted Stripe payment</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Session and webhook state for this invoice.
                  </p>
                </div>
                <Badge
                  tone={onlinePaymentTone(order.invoice.onlinePaymentStatus)}
                  className="capitalize"
                >
                  {onlinePaymentLabel(order.invoice.onlinePaymentStatus)}
                </Badge>
              </div>
              <div className="grid gap-2 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-2">
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Session
                  </span>
                  <p
                    className="font-mono"
                    title={order.invoice.onlinePaymentSessionId ?? ""}
                  >
                    {shortRef(order.invoice.onlinePaymentSessionId)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Payment intent
                  </span>
                  <p
                    className="font-mono"
                    title={order.invoice.onlinePaymentIntentId ?? ""}
                  >
                    {shortRef(order.invoice.onlinePaymentIntentId)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Expires
                  </span>
                  <p>
                    {order.invoice.onlinePaymentExpiresAt
                      ? formatDate(order.invoice.onlinePaymentExpiresAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Tax mode
                  </span>
                  <p>{onlinePaymentTaxModeLabel(order.invoice.onlinePaymentTaxMode)}</p>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Checkout URL
                  </span>
                  <p className="truncate">
                    {order.invoice.onlinePaymentUrl
                      ? "Active link stored"
                      : "No active link"}
                  </p>
                </div>
              </div>
              {order.invoice.onlinePaymentTaxMode === "stripe" && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-200">
                  Stripe Tax will recalculate tax at checkout. The paid receipt total
                  may differ from the saved invoice estimate.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                {order.invoice.onlinePaymentUrl && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => onCheckoutLinkAction(order, "open")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open checkout
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => onCheckoutLinkAction(order, "copy")}
                    >
                      <LinkIcon className="h-4 w-4" />
                      Copy checkout
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || !canRefreshCheckout}
                  onClick={() => onRefreshCheckout(order)}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh payment link
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Due date" htmlFor="invoice-due-at">
              <Input
                id="invoice-due-at"
                type="date"
                value={invoiceForm.dueAt}
                disabled={saving}
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    dueAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              label="Payment instructions"
              htmlFor="invoice-payment-instructions"
              hint="Shown on the invoice and sent in the email."
            >
              <Textarea
                id="invoice-payment-instructions"
                rows={3}
                value={invoiceForm.paymentInstructions}
                disabled={saving}
                placeholder="Example: Pay by Zelle, check, or card after confirmation."
                onChange={(event) =>
                  setInvoiceForm((current) => ({
                    ...current,
                    paymentInstructions: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field label="Invoice notes" htmlFor="invoice-notes">
            <Textarea
              id="invoice-notes"
              rows={3}
              value={invoiceForm.notes}
              disabled={saving}
              placeholder="Optional client-facing notes for this invoice."
              onChange={(event) =>
                setInvoiceForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </Field>

          {!order.email && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Add a customer email before sending this invoice.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {order.invoice && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => onInvoiceLinkAction(order, "open")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open {invoicePaid ? "receipt" : "invoice"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => onInvoiceLinkAction(order, "copy")}
                >
                  <LinkIcon className="h-4 w-4" />
                  Copy link
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onInvoiceSubmit(invoiceForm, false)}
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={saving || !order.email || invoicePaid}
              onClick={() => onInvoiceSubmit(invoiceForm, true)}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {invoicePaid ? "Invoice paid" : "Send invoice"}
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-medium">Payment receipt</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Record a manual payment and optionally send a receipt email.
              </p>
            </div>
            {invoicePaid ? (
              <Badge tone="green">
                Paid{" "}
                {formatMoney(
                  order.invoice?.paidAmountCents ?? order.totalCents,
                  order.currency,
                )}
              </Badge>
            ) : (
              <Badge tone="neutral">Awaiting payment</Badge>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Paid date" htmlFor="payment-paid-at">
              <Input
                id="payment-paid-at"
                type="date"
                value={paymentForm.paidAt}
                disabled={saving}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paidAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Amount paid" htmlFor="payment-paid-amount">
              <Input
                id="payment-paid-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={paymentForm.paidAmount}
                disabled={saving}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paidAmount: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Method" htmlFor="payment-method">
              <Input
                id="payment-method"
                value={paymentForm.paymentMethod}
                disabled={saving}
                placeholder="Zelle, check, cash, card"
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paymentMethod: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reference" htmlFor="payment-reference">
              <Input
                id="payment-reference"
                value={paymentForm.paymentReference}
                disabled={saving}
                placeholder="Check number or transaction ID"
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paymentReference: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Payment note" htmlFor="payment-note">
              <Textarea
                id="payment-note"
                rows={3}
                value={paymentForm.paymentNote}
                disabled={saving}
                placeholder="Optional note shown on the receipt."
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    paymentNote: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          {!order.email && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Add a customer email before sending a receipt.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || inputToCents(paymentForm.paidAmount) <= 0}
              onClick={() => previewEmail("receipt")}
            >
              {previewing === "receipt" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Preview receipt
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onPaymentSubmit(paymentForm, false)}
            >
              <CreditCard className="h-4 w-4" />
              {invoicePaid ? "Update payment" : "Record payment"}
            </Button>
            <Button
              type="button"
              disabled={saving || !order.email}
              onClick={() => onPaymentSubmit(paymentForm, true)}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ReceiptText className="h-4 w-4" />
              )}
              {invoicePaid ? "Send receipt" : "Record & send receipt"}
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-medium">Refunds</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Record manual refunds and optionally send a refund receipt.
              </p>
            </div>
            {refundedCents > 0 ? (
              <Badge tone={remainingRefundCents > 0 ? "amber" : "green"}>
                Refunded {formatMoney(refundedCents, order.currency)}
              </Badge>
            ) : (
              <Badge tone="neutral">No refunds</Badge>
            )}
          </div>

          {order.refunds.length > 0 && (
            <div className="space-y-2">
              {order.refunds.map((refund) => (
                <div
                  key={refund.id}
                  className="grid gap-2 rounded-md bg-[hsl(var(--muted))] p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-start"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {formatMoney(refund.amountCents, refund.currency)}
                      </p>
                      <Badge tone={refundTone(refund.status)} className="capitalize">
                        {refundLabel(refund.status)}
                      </Badge>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {refund.refundedAt
                          ? formatDate(refund.refundedAt)
                          : formatDate(refund.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                      {refund.method && <span>Method: {refund.method}</span>}
                      {refund.reference && <span>Reference: {refund.reference}</span>}
                      {refund.reason && <span>Reason: {refund.reason}</span>}
                      {refund.receiptSentAt && (
                        <span>Receipt sent {formatDate(refund.receiptSentAt)}</span>
                      )}
                    </div>
                    {refund.providerError && (
                      <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
                        Provider error: {refund.providerError}
                      </p>
                    )}
                    {refund.note && (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-[hsl(var(--muted-foreground))]">
                        {refund.note}
                      </p>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                    {refund.provider}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 rounded-md bg-[hsl(var(--muted))] p-3 text-sm sm:grid-cols-3">
            <span>Paid {formatMoney(paidAmountCents(order), order.currency)}</span>
            <span>Refunded {formatMoney(refundedCents, order.currency)}</span>
            <span>
              Refundable {formatMoney(remainingRefundCents, order.currency)}
              {reservedRefundCents > refundedCents
                ? ` (${formatMoney(
                    reservedRefundCents - refundedCents,
                    order.currency,
                  )} pending)`
                : ""}
            </span>
          </div>

          {!invoicePaid && (
            <p className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
              Record payment before adding a refund.
            </p>
          )}

          {invoicePaid &&
            !stripeRefundAvailable &&
            order.invoice?.onlinePaymentProvider === "stripe" && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                This Stripe invoice is missing a payment intent, so only a manual refund
                record is available.
              </p>
            )}

          <Field
            label="Refund action"
            htmlFor="refund-provider"
            hint={
              stripeRefundAvailable
                ? "Stripe refunds move money through Stripe; manual records only document outside refunds."
                : "Manual refund records document refunds handled outside this app."
            }
          >
            <Select
              id="refund-provider"
              value={refundForm.provider}
              disabled={saving || !invoicePaid}
              onChange={(event) =>
                setRefundForm((current) => ({
                  ...current,
                  provider: event.target.value as RefundProvider,
                }))
              }
            >
              {stripeRefundAvailable && (
                <option value="stripe">Refund through Stripe</option>
              )}
              <option value="manual">Manual record only</option>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Refund date" htmlFor="refund-refunded-at">
              <Input
                id="refund-refunded-at"
                type="date"
                value={refundForm.refundedAt}
                disabled={saving || !invoicePaid}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    refundedAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Amount" htmlFor="refund-amount">
              <Input
                id="refund-amount"
                type="number"
                min="0.01"
                max={centsToInput(remainingRefundCents)}
                step="0.01"
                value={refundForm.amount}
                disabled={saving || !invoicePaid || remainingRefundCents <= 0}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Method" htmlFor="refund-method">
              <Input
                id="refund-method"
                value={refundForm.provider === "stripe" ? "Stripe" : refundForm.method}
                disabled={saving || !invoicePaid || refundForm.provider === "stripe"}
                placeholder="Zelle, check, cash, Stripe dashboard"
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    method: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Reference" htmlFor="refund-reference">
              <Input
                id="refund-reference"
                value={refundForm.reference}
                disabled={saving || !invoicePaid || refundForm.provider === "stripe"}
                placeholder={
                  refundForm.provider === "stripe"
                    ? "Stripe refund ID is filled after creation"
                    : "Refund ID, check number, transaction ID"
                }
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Reason" htmlFor="refund-reason">
              <Input
                id="refund-reason"
                value={refundForm.reason}
                disabled={saving || !invoicePaid}
                placeholder="Client change, damaged print, duplicate payment"
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            label="Refund note"
            htmlFor="refund-note"
            hint="Shown on the customer receipt if you send or share the link."
          >
            <Textarea
              id="refund-note"
              rows={3}
              value={refundForm.note}
              disabled={saving || !invoicePaid}
              placeholder="Optional customer-facing refund note."
              onChange={(event) =>
                setRefundForm((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          </Field>

          {!order.email && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Add a customer email before sending a refund receipt.
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || !invoicePaid || remainingRefundCents <= 0}
              onClick={() =>
                setRefundForm((current) => ({
                  ...current,
                  amount: centsToInput(remainingRefundCents),
                }))
              }
            >
              Fill remaining
            </Button>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving || !canRecordRefund}
                onClick={() => previewEmail("refund")}
              >
                {previewing === "refund" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview refund
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || !canRecordRefund}
                onClick={() => onRefundSubmit(refundForm, false)}
              >
                <CreditCard className="h-4 w-4" />
                {refundForm.provider === "stripe"
                  ? "Refund through Stripe"
                  : "Record refund"}
              </Button>
              <Button
                type="button"
                disabled={saving || !canRecordRefund || !order.email}
                onClick={() => onRefundSubmit(refundForm, true)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ReceiptText className="h-4 w-4" />
                )}
                {refundForm.provider === "stripe"
                  ? "Refund & email receipt"
                  : "Record & email refund"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-medium">Fulfillment</h4>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Track preparation, delivery, and shipping details for this order.
              </p>
            </div>
            <Badge
              tone={fulfillmentTone(order.fulfillmentStatus)}
              className="capitalize"
            >
              {fulfillmentLabel(order.fulfillmentStatus)}
            </Badge>
          </div>

          <div className="grid gap-3 rounded-md bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
            <span>
              Ready{" "}
              {order.fulfillmentReadyAt ? formatDate(order.fulfillmentReadyAt) : "—"}
            </span>
            <span>
              Shipped{" "}
              {order.fulfillmentShippedAt
                ? formatDate(order.fulfillmentShippedAt)
                : "—"}
            </span>
            <span>
              Delivered{" "}
              {order.fulfillmentDeliveredAt
                ? formatDate(order.fulfillmentDeliveredAt)
                : "—"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fulfillment status" htmlFor="fulfillment-status">
              <Select
                id="fulfillment-status"
                value={fulfillmentForm.fulfillmentStatus}
                disabled={saving}
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentStatus: event.target.value as FulfillmentStatus,
                  }))
                }
              >
                {FULFILLMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {fulfillmentLabel(status)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Carrier" htmlFor="fulfillment-carrier">
              <Input
                id="fulfillment-carrier"
                value={fulfillmentForm.fulfillmentCarrier}
                disabled={saving}
                placeholder="USPS, UPS, FedEx, local pickup"
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentCarrier: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tracking number" htmlFor="fulfillment-tracking-number">
              <Input
                id="fulfillment-tracking-number"
                value={fulfillmentForm.fulfillmentTrackingNumber}
                disabled={saving}
                placeholder="Tracking or handoff reference"
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentTrackingNumber: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Tracking URL" htmlFor="fulfillment-tracking-url">
              <Input
                id="fulfillment-tracking-url"
                type="url"
                value={fulfillmentForm.fulfillmentTrackingUrl}
                disabled={saving}
                placeholder="https://..."
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentTrackingUrl: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ready date" htmlFor="fulfillment-ready-at">
              <Input
                id="fulfillment-ready-at"
                type="date"
                value={fulfillmentForm.fulfillmentReadyAt}
                disabled={saving}
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentReadyAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Shipped date" htmlFor="fulfillment-shipped-at">
              <Input
                id="fulfillment-shipped-at"
                type="date"
                value={fulfillmentForm.fulfillmentShippedAt}
                disabled={saving}
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentShippedAt: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Delivered date" htmlFor="fulfillment-delivered-at">
              <Input
                id="fulfillment-delivered-at"
                type="date"
                value={fulfillmentForm.fulfillmentDeliveredAt}
                disabled={saving}
                onChange={(event) =>
                  setFulfillmentForm((current) => ({
                    ...current,
                    fulfillmentDeliveredAt: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            label="Internal fulfillment notes"
            htmlFor="fulfillment-notes"
            hint="Private notes for packing, pickup, or handoff. Not shown to the customer."
          >
            <Textarea
              id="fulfillment-notes"
              rows={3}
              value={fulfillmentForm.fulfillmentNotes}
              disabled={saving}
              placeholder="Packing notes, pickup window, vendor order ID..."
              onChange={(event) =>
                setFulfillmentForm((current) => ({
                  ...current,
                  fulfillmentNotes: event.target.value,
                }))
              }
            />
          </Field>

          {!order.email && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Add a customer email before sending a fulfillment update.
            </p>
          )}
          {order.email && !canEmailFulfillment(fulfillmentForm.fulfillmentStatus) && (
            <p className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
              Email updates are available for ready, shipped, and delivered statuses.
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {(["ready", "shipped", "delivered"] as FulfillmentStatus[]).map(
                (status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => submitFulfillmentStatus(status, false)}
                  >
                    <PackageCheck className="h-4 w-4" />
                    Mark {fulfillmentLabel(status)}
                  </Button>
                ),
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  saving ||
                  !canEmailFulfillment(fulfillmentForm.fulfillmentStatus)
                }
                onClick={() => previewEmail("fulfillment")}
              >
                {previewing === "fulfillment" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview update
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onFulfillmentSubmit(fulfillmentForm, false)}
              >
                <PackageCheck className="h-4 w-4" />
                Save fulfillment
              </Button>
              <Button
                type="button"
                disabled={saving || !fulfillmentCanEmail}
                onClick={() => onFulfillmentSubmit(fulfillmentForm, true)}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Save & email update
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
          <div className="text-right">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Subtotal {formatMoney(order.subtotalCents, order.currency)}
            </p>
            {order.discountCents > 0 && (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Discount{order.promoCode ? ` (${order.promoCode})` : ""} -
                {formatMoney(order.discountCents, order.currency)}
              </p>
            )}
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Tax {formatMoney(order.taxCents, order.currency)}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Shipping
              {order.shippingProfileLabel ? ` (${order.shippingProfileLabel})` : ""}{" "}
              {formatMoney(order.shippingCents, order.currency)}
            </p>
            <p className="text-lg font-semibold">
              Total {formatMoney(order.totalCents, order.currency)}
            </p>
          </div>
        </div>
      </div>
      </Modal>
      {preview && (
        <EmailPreviewModal preview={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

export default function StorePage() {
  const { toast } = useToast();
  const { runWithStepUp } = useStepUp();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [orderAuditRows, setOrderAuditRows] = useState<
    Record<string, AuditLogRow[]>
  >({});
  const [loadingAuditOrderId, setLoadingAuditOrderId] = useState<string | null>(
    null,
  );
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("open");
  const [orderQuery, setOrderQuery] = useState("");
  const [productOpsFilter, setProductOpsFilter] =
    useState<ProductOpsFilter>("all");

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );

  const productInventory = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          productInventorySnapshot(product, orders),
        ]),
      ),
    [orders, products],
  );

  const productOpsCounts = useMemo(() => {
    return Object.fromEntries(
      PRODUCT_OPS_FILTERS.map((filter) => [
        filter.value,
        products.filter((product) =>
          productMatchesOpsFilter(
            product,
            productInventory.get(product.id) ??
              productInventorySnapshot(product, orders),
            filter.value,
          ),
        ).length,
      ]),
    ) as Record<ProductOpsFilter, number>;
  }, [orders, productInventory, products]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        productMatchesOpsFilter(
          product,
          productInventory.get(product.id) ??
            productInventorySnapshot(product, orders),
          productOpsFilter,
        ),
      ),
    [orders, productInventory, productOpsFilter, products],
  );

  const orderCounts = useMemo(() => {
    const counts = Object.fromEntries(
      ORDER_STATUS_OPTIONS.map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const order of orders) {
      counts[order.status] += 1;
    }
    const open = orders.filter((order) => OPEN_ORDER_STATUSES.has(order.status)).length;
    const saved = Object.fromEntries(
      SAVED_ORDER_FILTERS.map((filter) => [
        filter.value,
        orders.filter((order) => orderMatchesSavedFilter(order, filter.value))
          .length,
      ]),
    ) as Record<SavedOrderFilter, number>;
    return { counts, open, saved };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (!orderMatchesFilter(order, orderFilter)) return false;
      if (query && !orderSearchText(order).includes(query)) return false;
      return true;
    });
  }, [orderFilter, orderQuery, orders]);

  const selectedVisibleOrders = useMemo(
    () => visibleOrders.filter((order) => selectedOrderIds.has(order.id)),
    [selectedOrderIds, visibleOrders],
  );

  useEffect(() => {
    setSelectedOrderIds((current) => {
      const valid = new Set(orders.map((order) => order.id));
      const next = new Set([...current].filter((id) => valid.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [orders]);

  useEffect(() => {
    if (!selectedOrder) return;
    let cancelled = false;
    setLoadingAuditOrderId(selectedOrder.id);
    api
      .get<{ data: AuditLogRow[] }>(
        `/api/v1/admin/audit-log?entityType=order&entityId=${encodeURIComponent(
          selectedOrder.id,
        )}&limit=50`,
      )
      .then((res) => {
        if (cancelled) return;
        setOrderAuditRows((current) => ({
          ...current,
          [selectedOrder.id]: res.data,
        }));
      })
      .catch((err) => {
        if (!cancelled) toast(errMsg(err), "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingAuditOrderId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrder, toast]);

  const load = async () => {
    setLoading(true);
    try {
      const [productRes, orderRes, photoRes] = await Promise.all([
        api.get<{ data: ProductRow[] }>("/api/v1/admin/products"),
        api.get<{ data: OrderRow[] }>("/api/v1/admin/orders"),
        api.get<{ data: PhotoDTO[] }>("/api/v1/admin/photos?limit=100"),
      ]);
      setProducts(productRes.data);
      setOrders(orderRes.data);
      setPhotos(photoRes.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (values: ProductFormValues) => {
    try {
      await api.post("/api/v1/admin/products", toPayload(values));
      toast("Product created", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const update = async (id: string, values: ProductFormValues) => {
    try {
      await api.patch(`/api/v1/admin/products/${id}`, toPayload(values));
      toast("Product updated", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    }
  };

  const remove = async (row: ProductRow) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    setDeletingId(row.id);
    try {
      await runWithStepUp(() => api.del(`/api/v1/admin/products/${row.id}`));
      setProducts((current) => current.filter((product) => product.id !== row.id));
      toast("Product deleted", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const updateOrderStatus = async (row: OrderRow, status: OrderStatus) => {
    if (row.status === status) return;
    setUpdatingOrderId(row.id);
    try {
      const res = await api.patch<{ data: OrderRow }>(
        `/api/v1/admin/orders/${row.id}`,
        {
          status,
        },
      );
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data : order)),
      );
      setSelectedOrder(res.data);
      toast("Order status updated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      throw err;
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleOrderSelection = (id: string, checked: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const setVisibleOrderSelection = (checked: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      for (const order of visibleOrders) {
        if (checked) next.add(order.id);
        else next.delete(order.id);
      }
      return next;
    });
  };

  const bulkUpdateOrderStatus = async (status: OrderStatus) => {
    const targets = selectedVisibleOrders.filter((order) => order.status !== status);
    if (targets.length === 0) return;
    const confirmation = bulkStatusConfirmationMessage(status, targets);
    if (confirmation && !window.confirm(confirmation)) return;
    setBulkUpdating(true);
    try {
      const updated: OrderRow[] = [];
      for (const order of targets) {
        const res = await api.patch<{ data: OrderRow }>(
          `/api/v1/admin/orders/${order.id}`,
          { status },
        );
        updated.push(res.data);
      }
      setOrders((current) =>
        current.map((order) => updated.find((row) => row.id === order.id) ?? order),
      );
      if (selectedOrder) {
        const nextSelected = updated.find((row) => row.id === selectedOrder.id);
        if (nextSelected) setSelectedOrder(nextSelected);
      }
      setSelectedOrderIds(new Set());
      toast(
        `${updated.length} order${updated.length === 1 ? "" : "s"} updated`,
        "success",
      );
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBulkUpdating(false);
    }
  };

  const copySelectedOrders = async () => {
    if (selectedVisibleOrders.length === 0) return;
    await navigator.clipboard.writeText(
      selectedVisibleOrders.map(orderSummary).join("\n\n---\n\n"),
    );
    toast(
      `${selectedVisibleOrders.length} order summary${
        selectedVisibleOrders.length === 1 ? "" : "s"
      } copied`,
      "success",
    );
  };

  const exportSelectedOrders = () => {
    if (selectedVisibleOrders.length === 0) return;
    const blob = new Blob([selectedOrdersCsv(selectedVisibleOrders)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `store-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveInvoice = async (
    row: OrderRow,
    values: InvoiceFormValues,
    sendEmail: boolean,
  ) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: { order: OrderRow; invoiceUrl: string | null };
      }>(`/api/v1/admin/orders/${row.id}/invoice`, {
        dueAt: values.dueAt || null,
        notes: values.notes.trim() || null,
        paymentInstructions: values.paymentInstructions.trim() || null,
        sendEmail,
      });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      toast(sendEmail ? "Invoice sent" : "Invoice saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const recordPayment = async (
    row: OrderRow,
    values: PaymentFormValues,
    sendReceipt: boolean,
  ) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: { order: OrderRow; receiptUrl: string | null };
      }>(`/api/v1/admin/orders/${row.id}/payment`, {
        paidAt: values.paidAt || null,
        paidAmountCents: inputToCents(values.paidAmount),
        paymentMethod: values.paymentMethod.trim() || null,
        paymentReference: values.paymentReference.trim() || null,
        paymentNote: values.paymentNote.trim() || null,
        sendReceipt,
      });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      toast(sendReceipt ? "Receipt sent" : "Payment recorded", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const recordRefund = async (
    row: OrderRow,
    values: RefundFormValues,
    sendEmail: boolean,
  ) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: {
          order: OrderRow;
          refund: RefundRow;
          receiptUrl: string | null;
          warning: string | null;
        };
      }>(`/api/v1/admin/orders/${row.id}/refunds`, {
        amountCents: inputToCents(values.amount),
        status: "succeeded",
        provider: values.provider,
        method: values.provider === "stripe" ? null : values.method.trim() || null,
        reference:
          values.provider === "stripe" ? null : values.reference.trim() || null,
        reason: values.reason.trim() || null,
        note: values.note.trim() || null,
        refundedAt: values.refundedAt || null,
        sendEmail,
      });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      const refund = res.data.refund;
      if (refund.status === "failed") {
        toast(
          refund.providerError
            ? `Stripe refund failed: ${refund.providerError}`
            : "Stripe refund failed",
          "error",
        );
      } else if (values.provider === "stripe" && refund.status === "pending") {
        toast("Stripe refund started", "success");
      } else if (values.provider === "stripe") {
        toast(
          sendEmail ? "Stripe refund completed and emailed" : "Stripe refund completed",
          "success",
        );
      } else {
        toast(sendEmail ? "Refund recorded and emailed" : "Refund recorded", "success");
      }
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const saveFulfillment = async (
    row: OrderRow,
    values: FulfillmentFormValues,
    sendEmail: boolean,
  ) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: { order: OrderRow; receiptUrl: string | null };
      }>(`/api/v1/admin/orders/${row.id}/fulfillment`, {
        fulfillmentStatus: values.fulfillmentStatus,
        fulfillmentCarrier: values.fulfillmentCarrier.trim() || null,
        fulfillmentTrackingNumber: values.fulfillmentTrackingNumber.trim() || null,
        fulfillmentTrackingUrl: values.fulfillmentTrackingUrl.trim() || null,
        fulfillmentReadyAt: values.fulfillmentReadyAt || null,
        fulfillmentShippedAt: values.fulfillmentShippedAt || null,
        fulfillmentDeliveredAt: values.fulfillmentDeliveredAt || null,
        fulfillmentNotes: values.fulfillmentNotes.trim() || null,
        sendEmail,
      });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      toast(sendEmail ? "Fulfillment update sent" : "Fulfillment saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const savePackingChecklist = async (
    row: OrderRow,
    items: Array<{ itemId: string; checked: boolean }>,
  ) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{ data: OrderRow }>(
        `/api/v1/admin/orders/${row.id}/packing-checklist`,
        { items },
      );
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data : order)),
      );
      setSelectedOrder(res.data);
      toast("Packing checklist saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const useInvoiceLink = async (row: OrderRow, action: "open" | "copy") => {
    try {
      const res = await api.get<{
        data: { invoiceUrl: string; kind: "invoice" | "receipt" };
      }>(`/api/v1/admin/orders/${row.id}/invoice`);
      if (action === "open") {
        window.open(res.data.invoiceUrl, "_blank", "noopener,noreferrer");
        toast(`Opened ${res.data.kind}`, "success");
      } else {
        await navigator.clipboard.writeText(res.data.invoiceUrl);
        toast(
          `${res.data.kind === "receipt" ? "Receipt" : "Invoice"} link copied`,
          "success",
        );
      }
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const useCheckoutLink = async (row: OrderRow, action: "open" | "copy") => {
    const checkoutUrl = row.invoice?.onlinePaymentUrl;
    if (!checkoutUrl) {
      toast("No active Stripe checkout link is stored for this invoice.", "error");
      return;
    }
    try {
      if (action === "open") {
        window.open(checkoutUrl, "_blank", "noopener,noreferrer");
        toast("Opened Stripe checkout", "success");
      } else {
        await navigator.clipboard.writeText(checkoutUrl);
        toast("Stripe checkout link copied", "success");
      }
    } catch {
      toast("Could not use the checkout link in this browser.", "error");
    }
  };

  const useStatusLink = async (row: OrderRow, action: "open" | "copy") => {
    try {
      const res = await api.get<{ data: { statusUrl: string } }>(
        `/api/v1/admin/orders/${row.id}/status-link`,
      );
      if (action === "open") {
        window.open(res.data.statusUrl, "_blank", "noopener,noreferrer");
        toast("Opened order status", "success");
      } else {
        await navigator.clipboard.writeText(res.data.statusUrl);
        toast("Customer status link copied", "success");
      }
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const refreshCheckout = async (row: OrderRow) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: {
          order: OrderRow;
          checkoutUrl: string;
          invoiceUrl: string;
          taxMode: InvoiceRow["onlinePaymentTaxMode"];
          warning: string | null;
        };
      }>(`/api/v1/admin/orders/${row.id}/checkout`, { openNow: false });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      try {
        await navigator.clipboard.writeText(res.data.checkoutUrl);
        toast(
          res.data.warning ?? "Payment link refreshed and copied",
          res.data.warning ? "info" : "success",
        );
      } catch {
        toast(
          res.data.warning ?? "Payment link refreshed",
          res.data.warning ? "info" : "success",
        );
      }
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const copyOrder = async (row: OrderRow) => {
    try {
      await navigator.clipboard.writeText(orderSummary(row));
      toast("Order summary copied", "success");
    } catch {
      toast("Could not copy order summary", "error");
    }
  };

  const downloadTaxExport = () => {
    window.location.assign("/api/v1/admin/orders/tax-export");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Store</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {products.length} product{products.length === 1 ? "" : "s"}
            {categories.length
              ? ` across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}`
              : ""}
            {orders.length
              ? ` · ${orders.length} order request${orders.length === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New product
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add print, digital, or bundle products to power shop blocks."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">Product operations</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Stock reflects paid/fulfilled deductions; reserved demand is from draft,
                  pending, and invoiced requests.
                </p>
              </div>
              <Badge tone="neutral">
                {visibleProducts.length} of {products.length} shown
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRODUCT_OPS_FILTERS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  variant={
                    productOpsFilter === item.value ? "default" : "outline"
                  }
                  size="sm"
                  title={item.description}
                  onClick={() => setProductOpsFilter(item.value)}
                >
                  {item.label}
                  <span className="text-[0.68rem] opacity-75">
                    {productOpsCounts[item.value]}
                  </span>
                </Button>
              ))}
            </div>
            {visibleProducts.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-[hsl(var(--muted-foreground))]">
                No products match this operations filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Kind</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Price</th>
                      <th className="px-4 py-3 font-medium">Inventory</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const image = photoUrl(product.photo);
                      const sale =
                        product.salePriceCents !== null &&
                        product.salePriceCents < product.basePriceCents
                          ? product.salePriceCents
                          : null;
                      const inventory =
                        productInventory.get(product.id) ??
                        productInventorySnapshot(product, orders);
                      return (
                        <tr key={product.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-[hsl(var(--muted))]">
                                {image ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={image}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <ShoppingBag className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {product.name}
                                </p>
                                <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                  {product.sku} · /product/{product.slug}
                                </p>
                                {product.options.length > 0 && (
                                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                    {product.options.length} option
                                    {product.options.length === 1 ? "" : "s"} configured
                                  </p>
                                )}
                                {product.stripeTaxCode && (
                                  <p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">
                                    Tax code {product.stripeTaxCode}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 capitalize text-[hsl(var(--muted-foreground))]">
                            {product.kind}
                          </td>
                          <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                            {product.category ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {sale !== null ? (
                              <div>
                                <span className="mr-2 text-[hsl(var(--muted-foreground))] line-through">
                                  {formatMoney(product.basePriceCents, product.currency)}
                                </span>
                                <span className="font-medium">
                                  {formatMoney(sale, product.currency)}
                                </span>
                              </div>
                            ) : (
                              formatMoney(product.basePriceCents, product.currency)
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1">
                                <Badge tone={product.isActive ? "green" : "neutral"}>
                                  {product.isActive ? "Active" : "Hidden"}
                                </Badge>
                                <Badge tone={inventory.tone}>
                                  {inventory.label}
                                </Badge>
                                {product.isFeatured && (
                                  <Badge tone="blue">Featured</Badge>
                                )}
                              </div>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {inventory.detail}
                              </p>
                              {product.inventoryTracked &&
                                product.lowStockThreshold > 0 && (
                                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                    Low-stock threshold {product.lowStockThreshold}
                                  </p>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditing(product)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => remove(product)}
                                disabled={deletingId === product.id}
                              >
                                {deletingId === product.id && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-medium">Recent order requests</h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Public cart orders, manual invoices, and hosted Stripe checkout.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadTaxExport}
                >
                  <Download className="h-4 w-4" />
                  Tax CSV
                </Button>
                <Badge tone="neutral">
                  {visibleOrders.length} of {orders.length} shown
                </Badge>
              </div>
            </div>
            {orders.length > 0 && (
              <div className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {[
                        {
                          value: "open" as OrderFilter,
                          label: "Open",
                          count: orderCounts.open,
                        },
                        {
                          value: "all" as OrderFilter,
                          label: "All",
                          count: orders.length,
                        },
                        ...ORDER_STATUS_OPTIONS.map((status) => ({
                          value: status as OrderFilter,
                          label: status,
                          count: orderCounts.counts[status],
                        })),
                      ].map((item) => (
                        <Button
                          key={item.value}
                          type="button"
                          variant={orderFilter === item.value ? "default" : "outline"}
                          size="sm"
                          className="capitalize"
                          onClick={() => setOrderFilter(item.value)}
                        >
                          {item.label}
                          <span className="text-[0.68rem] opacity-75">
                            {item.count}
                          </span>
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SAVED_ORDER_FILTERS.map((item) => (
                        <Button
                          key={item.value}
                          type="button"
                          variant={orderFilter === item.value ? "default" : "outline"}
                          size="sm"
                          title={item.description}
                          onClick={() => setOrderFilter(item.value)}
                        >
                          {item.label}
                          <span className="text-[0.68rem] opacity-75">
                            {orderCounts.saved[item.value]}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                    <Input
                      value={orderQuery}
                      onChange={(event) => setOrderQuery(event.target.value)}
                      placeholder={`Search ${orderFilterLabel(orderFilter).toLowerCase()} orders`}
                      className="pl-9"
                    />
                  </label>
                </div>
                {visibleOrders.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <label className="inline-flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                      <input
                        type="checkbox"
                        checked={
                          visibleOrders.length > 0 &&
                          visibleOrders.every((order) =>
                            selectedOrderIds.has(order.id),
                          )
                        }
                        onChange={(event) =>
                          setVisibleOrderSelection(event.target.checked)
                        }
                      />
                      Select visible orders
                    </label>
                    <p className="text-[hsl(var(--muted-foreground))]">
                      Viewing {orderFilterLabel(orderFilter).toLowerCase()}
                    </p>
                  </div>
                )}
                {selectedVisibleOrders.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-[hsl(var(--muted))] p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {selectedVisibleOrders.length} selected from this view
                      </p>
                      <p className="text-[hsl(var(--muted-foreground))]">
                        Bulk status changes use the normal audited order update path.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["paid", "fulfilled", "cancelled"] as OrderStatus[]).map(
                        (status) => (
                          <Button
                            key={status}
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={bulkUpdating}
                            className="capitalize"
                            onClick={() => bulkUpdateOrderStatus(status)}
                          >
                            {bulkUpdating && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Mark {status}
                          </Button>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkUpdating}
                        onClick={copySelectedOrders}
                      >
                        <Copy className="h-4 w-4" />
                        Copy summaries
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkUpdating}
                        onClick={exportSelectedOrders}
                      >
                        <Download className="h-4 w-4" />
                        Export selected
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={bulkUpdating}
                        onClick={() => setSelectedOrderIds(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {orders.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-[hsl(var(--muted-foreground))]">
                No order requests yet.
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-[hsl(var(--muted-foreground))]">
                No order requests match the current filter.
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {visibleOrders.map((row) => (
                    <div key={row.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select order ${row.id}`}
                            checked={selectedOrderIds.has(row.id)}
                            onChange={(event) =>
                              toggleOrderSelection(row.id, event.target.checked)
                            }
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <p className="break-words font-medium">
                              {row.clientName || row.email || "Unknown"}
                            </p>
                            {row.email && (
                              <p className="break-words text-xs text-[hsl(var(--muted-foreground))]">
                                {row.email}
                              </p>
                            )}
                          </div>
                        </div>
                        <Badge
                          tone={orderTone(row.status)}
                          className="shrink-0 capitalize"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      {orderTriageBadges(row).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {orderTriageBadges(row).map((badge) => (
                            <Badge
                              key={badge.key}
                              tone={badge.tone}
                              className="capitalize"
                            >
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 space-y-2 text-sm">
                        {row.items.length === 0 ? (
                          <p className="text-[hsl(var(--muted-foreground))]">
                            No items
                          </p>
                        ) : (
                          row.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-md bg-[hsl(var(--muted))] p-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 break-words">
                                  {item.quantity} × {orderItemTitle(item)}
                                </p>
                                <span className="shrink-0 font-medium">
                                  {formatMoney(item.lineTotalCents, row.currency)}
                                </span>
                              </div>
                              {item.options.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {item.options.map((option) => (
                                    <span
                                      key={`${item.id}-${option.optionId}`}
                                      className="rounded border bg-[hsl(var(--background))] px-1.5 py-0.5 text-[0.68rem] text-[hsl(var(--muted-foreground))]"
                                    >
                                      {optionLine(option, row.currency)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
                        <div>
                          <p className="font-medium">
                            {formatMoney(row.totalCents, row.currency)}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {formatDate(row.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(row)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[54rem] text-sm">
                    <thead>
                      <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                        <th className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label="Select visible orders"
                            checked={
                              visibleOrders.length > 0 &&
                              visibleOrders.every((order) =>
                                selectedOrderIds.has(order.id),
                              )
                            }
                            onChange={(event) =>
                              setVisibleOrderSelection(event.target.checked)
                            }
                          />
                        </th>
                        <th className="px-3 py-2 font-medium">Customer</th>
                        <th className="px-3 py-2 font-medium">Items</th>
                        <th className="px-3 py-2 font-medium">Total</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Received</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleOrders.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select order ${row.id}`}
                              checked={selectedOrderIds.has(row.id)}
                              onChange={(event) =>
                                toggleOrderSelection(row.id, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">
                              {row.clientName || row.email || "Unknown"}
                            </p>
                            {row.email && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {row.email}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                              {row.id}
                            </p>
                          </td>
                          <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                            {row.items.length === 0 ? (
                              "—"
                            ) : (
                              <div className="space-y-1">
                                {row.items.map((item) => (
                                  <div key={item.id} className="space-y-1">
                                    <div>
                                      {item.quantity} × {orderItemTitle(item)} ·{" "}
                                      {formatMoney(item.lineTotalCents, row.currency)}
                                    </div>
                                    {item.options.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {item.options.map((option) => (
                                          <span
                                            key={`${item.id}-${option.optionId}`}
                                            className="rounded border px-1.5 py-0.5 text-[0.68rem]"
                                          >
                                            {optionLine(option, row.currency)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3 font-medium">
                            {formatMoney(row.totalCents, row.currency)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <Badge
                                tone={orderTone(row.status)}
                                className="capitalize"
                              >
                                {row.status}
                              </Badge>
                              {orderTriageBadges(row).map((badge) => (
                                <Badge
                                  key={badge.key}
                                  tone={badge.tone}
                                  className="capitalize"
                                >
                                  {badge.label}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedOrder(row)}
                              >
                                <Eye className="h-4 w-4" />
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {creating && (
        <ProductModal
          title="New product"
          initial={EMPTY_FORM}
          photos={photos}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      )}

      {editing && (
        <ProductModal
          title="Edit product"
          initial={toForm(editing)}
          photos={photos}
          onClose={() => setEditing(null)}
          onSubmit={(values) => update(editing.id, values)}
        />
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          saving={updatingOrderId === selectedOrder.id}
          auditRows={orderAuditRows[selectedOrder.id] ?? []}
          auditLoading={loadingAuditOrderId === selectedOrder.id}
          onClose={() => setSelectedOrder(null)}
          onCopy={copyOrder}
          onStatusChange={(status) => updateOrderStatus(selectedOrder, status)}
          onInvoiceSubmit={(values, sendEmail) =>
            saveInvoice(selectedOrder, values, sendEmail)
          }
          onPaymentSubmit={(values, sendReceipt) =>
            recordPayment(selectedOrder, values, sendReceipt)
          }
          onRefundSubmit={(values, sendEmail) =>
            recordRefund(selectedOrder, values, sendEmail)
          }
          onFulfillmentSubmit={(values, sendEmail) =>
            saveFulfillment(selectedOrder, values, sendEmail)
          }
          onPackingChecklistSubmit={(items) =>
            savePackingChecklist(selectedOrder, items)
          }
          onInvoiceLinkAction={useInvoiceLink}
          onCheckoutLinkAction={useCheckoutLink}
          onStatusLinkAction={useStatusLink}
          onRefreshCheckout={refreshCheckout}
        />
      )}
    </div>
  );
}
