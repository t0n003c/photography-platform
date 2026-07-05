"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Loader2, Plus, ShoppingBag } from "lucide-react";
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
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface OrderRow {
  id: string;
  clientName: string | null;
  email: string | null;
  status: "draft" | "pending" | "paid" | "fulfilled" | "cancelled";
  subtotalCents: number;
  totalCents: number;
  currency: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  createdAt: string;
  items: {
    id: string;
    description: string | null;
    quantity: number;
    lineTotalCents: number;
  }[];
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

function photoUrl(photo: PhotoDTO | null | undefined) {
  if (!photo) return null;
  const pick =
    photo.variants.find((variant) => variant.format === "webp" && variant.sizeBucket === "small") ??
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
          <Field label="Tags" htmlFor="product-tags" hint="Comma-separated labels for filtering/tag cloud.">
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
              onChange={(event) => setForm({ ...form, isFeatured: event.target.checked })}
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Store</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {products.length} product{products.length === 1 ? "" : "s"}
            {categories.length ? ` across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}` : ""}
            {orders.length ? ` · ${orders.length} order request${orders.length === 1 ? "" : "s"}` : ""}
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
                              <img src={image} alt="" className="h-full w-full object-cover" />
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
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-3 py-3">
                          <p className="font-medium">{row.clientName || row.email || "Unknown"}</p>
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
    </div>
  );
}
