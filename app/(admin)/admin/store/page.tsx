"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import {
  Copy,
  CreditCard,
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
  taxCents: number;
  shippingCents: number;
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
  invoice: InvoiceRow | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productId: string | null;
    photoId: string | null;
    description: string | null;
    options: SelectedProductOption[];
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
}

type OrderStatus = OrderRow["status"];
type FulfillmentStatus = OrderRow["fulfillmentStatus"];
type OrderFilter = "all" | "open" | OrderStatus;

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

interface ProductFormValues {
  name: string;
  slug: string;
  sku: string;
  description: string;
  kind: ProductKind;
  photoId: string | null;
  basePrice: string;
  salePrice: string;
  currency: string;
  category: string;
  tags: string;
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
  kind: "print",
  photoId: null,
  basePrice: "",
  salePrice: "",
  currency: "USD",
  category: "",
  tags: "",
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
    if (item.options.length === 0) return [head];
    return [
      head,
      ...item.options.map((option) => `  ${optionLine(option, row.currency)}`),
    ];
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
    `Tax: ${formatMoney(row.taxCents, row.currency)}`,
    `Shipping: ${formatMoney(row.shippingCents, row.currency)}`,
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
    row.invoice?.onlinePaymentSessionId
      ? `Stripe session: ${row.invoice.onlinePaymentSessionId}`
      : null,
    row.invoice?.onlinePaymentIntentId
      ? `Stripe payment intent: ${row.invoice.onlinePaymentIntentId}`
      : null,
    `Fulfillment: ${fulfillmentLabel(row.fulfillmentStatus)}`,
    row.fulfillmentCarrier ? `Carrier: ${row.fulfillmentCarrier}` : null,
    row.fulfillmentTrackingNumber
      ? `Tracking: ${row.fulfillmentTrackingNumber}`
      : null,
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
    kind: product.kind,
    photoId: product.photoId,
    basePrice: centsToInput(product.basePriceCents),
    salePrice: centsToInput(product.salePriceCents),
    currency: product.currency,
    category: product.category ?? "",
    tags: product.tags.join(", "),
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
    kind: form.kind,
    photoId: form.photoId,
    basePriceCents: inputToCents(form.basePrice),
    salePriceCents: nullablePriceToCents(form.salePrice),
    currency: (form.currency.trim() || "USD").toUpperCase(),
    category: form.category.trim() || null,
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
                    className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
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

function OrderDetailModal({
  order,
  saving,
  onClose,
  onCopy,
  onStatusChange,
  onInvoiceSubmit,
  onPaymentSubmit,
  onFulfillmentSubmit,
  onInvoiceLinkAction,
  onCheckoutLinkAction,
  onRefreshCheckout,
}: {
  order: OrderRow;
  saving: boolean;
  onClose: () => void;
  onCopy: (order: OrderRow) => void;
  onStatusChange: (status: OrderStatus) => Promise<void>;
  onInvoiceSubmit: (values: InvoiceFormValues, sendEmail: boolean) => Promise<void>;
  onPaymentSubmit: (values: PaymentFormValues, sendReceipt: boolean) => Promise<void>;
  onFulfillmentSubmit: (
    values: FulfillmentFormValues,
    sendEmail: boolean,
  ) => Promise<void>;
  onInvoiceLinkAction: (order: OrderRow, action: "open" | "copy") => Promise<void>;
  onCheckoutLinkAction: (order: OrderRow, action: "open" | "copy") => Promise<void>;
  onRefreshCheckout: (order: OrderRow) => Promise<void>;
}) {
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
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedOptionCount = order.items.reduce(
    (sum, item) => sum + item.options.length,
    0,
  );
  const invoicePaid = order.invoice?.status === "paid";
  const canRefreshCheckout = order.invoice?.status === "issued";
  const fulfillmentCanEmail =
    Boolean(order.email) && canEmailFulfillment(fulfillmentForm.fulfillmentStatus);
  const nextStatus: OrderStatus | null =
    order.status === "draft" || order.status === "pending" || order.status === "invoiced"
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
  }, [order.id, order.invoice, order.totalCents, order]);

  const submitFulfillmentStatus = (
    status: FulfillmentStatus,
    sendEmail: boolean,
  ) => {
    const values = { ...fulfillmentForm, fulfillmentStatus: status };
    setFulfillmentForm(values);
    return onFulfillmentSubmit(values, sendEmail);
  };

  return (
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
                Issued {order.invoice.issuedAt ? formatDate(order.invoice.issuedAt) : "—"}
              </span>
              <span>Sent {order.invoice.sentAt ? formatDate(order.invoice.sentAt) : "—"}</span>
              <span>Paid {order.invoice.paidAt ? formatDate(order.invoice.paidAt) : "—"}</span>
              <span>
                Receipt {order.invoice.receiptSentAt ? formatDate(order.invoice.receiptSentAt) : "—"}
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
                  <p className="font-mono" title={order.invoice.onlinePaymentSessionId ?? ""}>
                    {shortRef(order.invoice.onlinePaymentSessionId)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    Payment intent
                  </span>
                  <p className="font-mono" title={order.invoice.onlinePaymentIntentId ?? ""}>
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
                    Checkout URL
                  </span>
                  <p className="truncate">
                    {order.invoice.onlinePaymentUrl ? "Active link stored" : "No active link"}
                  </p>
                </div>
              </div>
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
              {order.fulfillmentReadyAt
                ? formatDate(order.fulfillmentReadyAt)
                : "—"}
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
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Tax {formatMoney(order.taxCents, order.currency)}
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Shipping {formatMoney(order.shippingCents, order.currency)}
            </p>
            <p className="text-lg font-semibold">
              Total {formatMoney(order.totalCents, order.currency)}
            </p>
          </div>
        </div>
      </div>
    </Modal>
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
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("open");
  const [orderQuery, setOrderQuery] = useState("");

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );

  const orderCounts = useMemo(() => {
    const counts = Object.fromEntries(
      ORDER_STATUS_OPTIONS.map((status) => [status, 0]),
    ) as Record<OrderStatus, number>;
    for (const order of orders) {
      counts[order.status] += 1;
    }
    const open = orders.filter((order) => OPEN_ORDER_STATUSES.has(order.status)).length;
    return { counts, open };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderFilter === "open" && !OPEN_ORDER_STATUSES.has(order.status))
        return false;
      if (
        orderFilter !== "all" &&
        orderFilter !== "open" &&
        order.status !== orderFilter
      ) {
        return false;
      }
      if (query && !orderSearchText(order).includes(query)) return false;
      return true;
    });
  }, [orderFilter, orderQuery, orders]);

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
        toast(`${res.data.kind === "receipt" ? "Receipt" : "Invoice"} link copied`, "success");
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

  const refreshCheckout = async (row: OrderRow) => {
    setUpdatingOrderId(row.id);
    try {
      const res = await api.post<{
        data: { order: OrderRow; checkoutUrl: string; invoiceUrl: string };
      }>(`/api/v1/admin/orders/${row.id}/checkout`, { openNow: false });
      setOrders((current) =>
        current.map((order) => (order.id === row.id ? res.data.order : order)),
      );
      setSelectedOrder(res.data.order);
      try {
        await navigator.clipboard.writeText(res.data.checkoutUrl);
        toast("Payment link refreshed and copied", "success");
      } catch {
        toast("Payment link refreshed", "success");
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
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[58rem] text-sm">
              <thead>
                <tr className="border-b text-left text-[hsl(var(--muted-foreground))]">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const image = photoUrl(product.photo);
                  const sale =
                    product.salePriceCents !== null &&
                    product.salePriceCents < product.basePriceCents
                      ? product.salePriceCents
                      : null;
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
                            <p className="truncate font-medium">{product.name}</p>
                            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                              {product.sku} · /product/{product.slug}
                            </p>
                            {product.options.length > 0 && (
                              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                {product.options.length} option
                                {product.options.length === 1 ? "" : "s"} configured
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
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={product.isActive ? "green" : "neutral"}>
                            {product.isActive ? "Active" : "Hidden"}
                          </Badge>
                          {product.isFeatured && <Badge tone="blue">Featured</Badge>}
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
              <Badge tone="neutral">
                {visibleOrders.length} of {orders.length} shown
              </Badge>
            </div>
            {orders.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-[1fr_18rem]">
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      value: "open" as OrderFilter,
                      label: "Open",
                      count: orderCounts.open,
                    },
                    { value: "all" as OrderFilter, label: "All", count: orders.length },
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
                      <span className="text-[0.68rem] opacity-75">{item.count}</span>
                    </Button>
                  ))}
                </div>
                <label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    value={orderQuery}
                    onChange={(event) => setOrderQuery(event.target.value)}
                    placeholder="Search orders"
                    className="pl-9"
                  />
                </label>
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
                        <Badge
                          tone={orderTone(row.status)}
                          className="shrink-0 capitalize"
                        >
                          {row.status}
                        </Badge>
                      </div>
                      {row.invoice?.onlinePaymentStatus && (
                        <div className="mt-2">
                          <Badge
                            tone={onlinePaymentTone(row.invoice.onlinePaymentStatus)}
                            className="capitalize"
                          >
                            Stripe {onlinePaymentLabel(row.invoice.onlinePaymentStatus)}
                          </Badge>
                        </div>
                      )}
                      {row.fulfillmentStatus !== "unfulfilled" && (
                        <div className="mt-2">
                          <Badge
                            tone={fulfillmentTone(row.fulfillmentStatus)}
                            className="capitalize"
                          >
                            Fulfillment {fulfillmentLabel(row.fulfillmentStatus)}
                          </Badge>
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
                              {row.invoice?.onlinePaymentStatus && (
                                <Badge
                                  tone={onlinePaymentTone(row.invoice.onlinePaymentStatus)}
                                  className="capitalize"
                                >
                                  Stripe{" "}
                                  {onlinePaymentLabel(row.invoice.onlinePaymentStatus)}
                                </Badge>
                              )}
                              {row.fulfillmentStatus !== "unfulfilled" && (
                                <Badge
                                  tone={fulfillmentTone(row.fulfillmentStatus)}
                                  className="capitalize"
                                >
                                  Fulfillment{" "}
                                  {fulfillmentLabel(row.fulfillmentStatus)}
                                </Badge>
                              )}
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
          onClose={() => setSelectedOrder(null)}
          onCopy={copyOrder}
          onStatusChange={(status) => updateOrderStatus(selectedOrder, status)}
          onInvoiceSubmit={(values, sendEmail) =>
            saveInvoice(selectedOrder, values, sendEmail)
          }
          onPaymentSubmit={(values, sendReceipt) =>
            recordPayment(selectedOrder, values, sendReceipt)
          }
          onFulfillmentSubmit={(values, sendEmail) =>
            saveFulfillment(selectedOrder, values, sendEmail)
          }
          onInvoiceLinkAction={useInvoiceLink}
          onCheckoutLinkAction={useCheckoutLink}
          onRefreshCheckout={refreshCheckout}
        />
      )}
    </div>
  );
}
