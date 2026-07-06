import { z } from "zod";
import { and, eq, ne, or } from "drizzle-orm";
import { requireFreshAuth, requireRole } from "@/src/auth/session";
import { conflict, noContent, notFound, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { product } from "@/src/db/schema";
import { getProductByIdAdmin } from "@/src/db/queries/store";
import { normalizeProductOptions } from "@/src/lib/store-options";
import { normalizeStripeTaxCode } from "@/src/lib/store-settings";

export const dynamic = "force-dynamic";

const ProductKind = z.enum(["print", "digital", "bundle"]);

const ProductOptionValueSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  priceDeltaCents: z.number().int().default(0),
});

const ProductOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  required: z.boolean().default(true),
  values: z.array(ProductOptionValueSchema).min(1),
});

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().nullable().optional(),
  kind: ProductKind.optional(),
  photoId: z.string().nullable().optional(),
  basePriceCents: z.number().int().min(0).optional(),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().min(3).max(3).optional(),
  category: z.string().nullable().optional(),
  stripeTaxCode: z.string().max(80).nullable().optional(),
  tags: z.array(z.string()).optional(),
  options: z.array(ProductOptionSchema).optional(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
}

async function productExists(id: string) {
  const rows = await db
    .select({ id: product.id })
    .from(product)
    .where(eq(product.id, id))
    .limit(1);
  return Boolean(rows[0]);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await getProductByIdAdmin(id);
  if (!row) return notFound();
  return ok(row);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  if (!(await productExists(id))) return notFound();

  const nextSlug = body.slug === undefined ? undefined : slugify(body.slug);
  const nextSku = body.sku === undefined ? undefined : body.sku.trim();
  if (nextSlug === "") return conflict("SLUG_REQUIRED", "Product slug is required.");
  if (nextSku === "") return conflict("SKU_REQUIRED", "Product SKU is required.");

  if (nextSlug !== undefined || nextSku !== undefined) {
    const checks = [];
    if (nextSlug !== undefined) checks.push(eq(product.slug, nextSlug));
    if (nextSku !== undefined) checks.push(eq(product.sku, nextSku));
    const dup = await db
      .select({ id: product.id })
      .from(product)
      .where(and(ne(product.id, id), or(...checks)!))
      .limit(1);
    if (dup.length) {
      return conflict("PRODUCT_TAKEN", "That product slug or SKU is already in use.");
    }
  }

  const updates: Partial<typeof product.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (nextSlug !== undefined) updates.slug = nextSlug;
  if (nextSku !== undefined) updates.sku = nextSku;
  if (body.description !== undefined)
    updates.description = body.description?.trim() || null;
  if (body.kind !== undefined) updates.kind = body.kind;
  if (body.photoId !== undefined) updates.photoId = body.photoId;
  if (body.basePriceCents !== undefined) updates.basePriceCents = body.basePriceCents;
  if (body.salePriceCents !== undefined) updates.salePriceCents = body.salePriceCents;
  if (body.currency !== undefined) updates.currency = body.currency.toUpperCase();
  if (body.category !== undefined) updates.category = body.category?.trim() || null;
  if (body.stripeTaxCode !== undefined) {
    updates.stripeTaxCode = normalizeStripeTaxCode(body.stripeTaxCode);
  }
  if (body.tags !== undefined) updates.tags = cleanTags(body.tags);
  if (body.options !== undefined)
    updates.options = normalizeProductOptions(body.options);
  if (body.isFeatured !== undefined) updates.isFeatured = body.isFeatured;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  await db.update(product).set(updates).where(eq(product.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "product.update",
    entityType: "product",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFreshAuth("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  if (!(await productExists(id))) return notFound();

  await db.delete(product).where(eq(product.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "product.delete",
    entityType: "product",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
