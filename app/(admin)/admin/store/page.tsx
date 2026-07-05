"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Copy, Eye, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
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
  status: "draft" | "pending" | "paid" | "fulfilled" | "cancelled";
  subtotalCents: number;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentRef: string | null;
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

function orderTone(status: OrderRow["status"]): ComponentProps<typeof Badge>["tone"] {
  if (status === "pending" || status === "draft") return "amber";
  if (status === "paid" || status === "fulfilled") return "green";
  if (status === "cancelled") return "red";
  return "neutral";
}

function orderSummary(row: OrderRow) {
  const lines = row.items.map(
    (item) =>
      `- ${item.quantity} x ${item.description || "Product"} @ ${formatMoney(
        item.unitPriceCents,
        row.currency,
      )} = ${formatMoney(item.lineTotalCents, row.currency)}`,
  );
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
    `Total: ${formatMoney(row.totalCents, row.currency)}`,
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
}: {
  order: OrderRow;
  saving: boolean;
  onClose: () => void;
  onCopy: (order: OrderRow) => void;
  onStatusChange: (status: OrderStatus) => Promise<void>;
}) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Modal open onClose={onClose} title="Order request" className="w-[min(94vw,46rem)]">
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
          </div>
          <Badge tone={orderTone(order.status)} className="capitalize">
            {order.status}
          </Badge>
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
                  <td className="px-3 py-2">{item.description || "Product"}</td>
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
              <option value="paid">Paid</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Button type="button" variant="outline" onClick={() => onCopy(order)}>
            <Copy className="h-4 w-4" />
            Copy summary
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </p>
          <div className="text-right">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Subtotal {formatMoney(order.subtotalCents, order.currency)}
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

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))],
    [products],
  );

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
                  Manual invoice requests submitted from the public cart.
                </p>
              </div>
              <Badge tone="neutral">{orders.length} total</Badge>
            </div>
            {orders.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-sm text-[hsl(var(--muted-foreground))]">
                No order requests yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                    {orders.map((row) => (
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
                                <div key={item.id}>
                                  {item.quantity} × {item.description || "Product"} ·{" "}
                                  {formatMoney(item.lineTotalCents, row.currency)}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {formatMoney(row.totalCents, row.currency)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={orderTone(row.status)} className="capitalize">
                            {row.status}
                          </Badge>
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
        />
      )}
    </div>
  );
}
