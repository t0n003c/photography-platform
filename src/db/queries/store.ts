import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import { product } from "@/src/db/schema";
import { serializePhotos, type PhotoDTO } from "@/src/db/queries/photos";
import { photo } from "@/src/db/schema";

export type ProductRow = typeof product.$inferSelect;

export interface ProductDTO {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string | null;
  kind: "print" | "digital" | "bundle";
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
  createdAt: string;
  updatedAt: string;
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartLineDTO {
  product: ProductDTO;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CartSummaryDTO {
  lines: CartLineDTO[];
  unavailableProductIds: string[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  hasMixedCurrency: boolean;
}

export function productSalePrice(
  row: Pick<ProductRow, "basePriceCents" | "salePriceCents">,
): number | null {
  if (row.salePriceCents === null) return null;
  return row.salePriceCents < row.basePriceCents ? row.salePriceCents : null;
}

export function productCurrentPrice(
  row: Pick<ProductRow, "basePriceCents" | "salePriceCents">,
): number {
  return productSalePrice(row) ?? row.basePriceCents;
}

export function normalizeCartItems(items: CartItemInput[]): CartItemInput[] {
  const byProduct = new Map<string, number>();
  for (const item of items) {
    const productId = item.productId.trim();
    if (!productId) continue;
    const quantity = Math.min(Math.max(Math.floor(item.quantity || 1), 1), 99);
    byProduct.set(productId, Math.min((byProduct.get(productId) ?? 0) + quantity, 99));
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

async function productPhotos(rows: ProductRow[]): Promise<Map<string, PhotoDTO>> {
  const ids = [...new Set(rows.map((row) => row.photoId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const photoRows = await db.select().from(photo).where(inArray(photo.id, ids));
  const dtos = await serializePhotos(photoRows.filter((row) => !row.deletedAt));
  return new Map(dtos.map((dto) => [dto.id, dto]));
}

export async function serializeProducts(rows: ProductRow[]): Promise<ProductDTO[]> {
  const photos = await productPhotos(rows);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    kind: row.kind,
    photoId: row.photoId,
    photo: row.photoId ? photos.get(row.photoId) ?? null : null,
    basePriceCents: row.basePriceCents,
    salePriceCents: row.salePriceCents,
    currency: row.currency,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : [],
    isFeatured: row.isFeatured,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listProductsAdmin(): Promise<ProductDTO[]> {
  const rows = await db
    .select()
    .from(product)
    .orderBy(asc(product.sortOrder), asc(product.name));
  return serializeProducts(rows);
}

export async function listProductsPublic(opts: {
  source?: "all" | "featured" | "category";
  category?: string;
  limit?: number;
} = {}): Promise<ProductDTO[]> {
  const conds = [eq(product.isActive, true)];
  if (opts.source === "featured") conds.push(eq(product.isFeatured, true));
  if (opts.source === "category" && opts.category?.trim()) {
    conds.push(eq(product.category, opts.category.trim()));
  }
  const rows = await db
    .select()
    .from(product)
    .where(and(...conds))
    .orderBy(asc(product.sortOrder), asc(product.name))
    .limit(Math.min(Math.max(opts.limit ?? 24, 1), 48));
  return serializeProducts(rows);
}

export async function listActiveProductsByIds(ids: string[]): Promise<ProductDTO[]> {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const rows = await db
    .select()
    .from(product)
    .where(and(inArray(product.id, uniqueIds), eq(product.isActive, true)));
  return serializeProducts(rows);
}

export async function resolveCartItems(items: CartItemInput[]): Promise<CartSummaryDTO> {
  const normalized = normalizeCartItems(items);
  const products = await listActiveProductsByIds(
    normalized.map((item) => item.productId),
  );
  const productsById = new Map(products.map((item) => [item.id, item]));
  const lines = normalized.flatMap<CartLineDTO>((item) => {
    const row = productsById.get(item.productId);
    if (!row) return [];
    const unitPriceCents = productCurrentPrice(row);
    return [
      {
        product: row,
        quantity: item.quantity,
        unitPriceCents,
        lineTotalCents: unitPriceCents * item.quantity,
      },
    ];
  });
  const currencies = [...new Set(lines.map((line) => line.product.currency))];
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  return {
    lines,
    unavailableProductIds: normalized
      .map((item) => item.productId)
      .filter((id) => !productsById.has(id)),
    subtotalCents,
    totalCents: subtotalCents,
    currency: currencies[0] ?? "USD",
    hasMixedCurrency: currencies.length > 1,
  };
}

export async function getProductByIdAdmin(id: string): Promise<ProductDTO | null> {
  const rows = await db.select().from(product).where(eq(product.id, id)).limit(1);
  const [dto] = await serializeProducts(rows);
  return dto ?? null;
}

export async function getActiveProductById(id: string): Promise<ProductDTO | null> {
  const rows = await db
    .select()
    .from(product)
    .where(and(eq(product.id, id), eq(product.isActive, true)))
    .limit(1);
  const [dto] = await serializeProducts(rows);
  return dto ?? null;
}

export async function getActiveProductBySlug(slug: string): Promise<ProductDTO | null> {
  const rows = await db
    .select()
    .from(product)
    .where(and(eq(product.slug, slug), eq(product.isActive, true)))
    .limit(1);
  const [dto] = await serializeProducts(rows);
  return dto ?? null;
}
