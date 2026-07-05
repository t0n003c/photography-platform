import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, conflict, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { product } from "@/src/db/schema";
import { listProductsAdmin } from "@/src/db/queries/store";
import { normalizeProductOptions } from "@/src/lib/store-options";

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

const CreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  sku: z.string().optional(),
  description: z.string().nullable().optional(),
  kind: ProductKind.default("print"),
  photoId: z.string().nullable().optional(),
  basePriceCents: z.number().int().min(0).default(0),
  salePriceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().min(3).max(3).default("USD"),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  options: z.array(ProductOptionSchema).default([]),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
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

export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const data = await listProductsAdmin();
  return ok({ data });
}

export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const slug = slugify(body.slug || body.name);
  const sku = (body.sku || slug).trim();
  if (!slug) return conflict("SLUG_REQUIRED", "Product slug is required.");
  if (!sku) return conflict("SKU_REQUIRED", "Product SKU is required.");

  const duplicate = await db
    .select({ id: product.id })
    .from(product)
    .where(or(eq(product.slug, slug), eq(product.sku, sku)))
    .limit(1);
  if (duplicate.length) {
    return conflict("PRODUCT_TAKEN", "That product slug or SKU is already in use.");
  }

  const id = newId();
  await db.insert(product).values({
    id,
    slug,
    sku,
    name: body.name.trim(),
    description: body.description?.trim() || null,
    kind: body.kind,
    photoId: body.photoId ?? null,
    basePriceCents: body.basePriceCents,
    salePriceCents: body.salePriceCents ?? null,
    currency: body.currency.toUpperCase(),
    category: body.category?.trim() || null,
    tags: cleanTags(body.tags),
    options: normalizeProductOptions(body.options),
    isFeatured: body.isFeatured,
    isActive: body.isActive,
    sortOrder: body.sortOrder,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "product.create",
    entityType: "product",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { slug, sku },
  });

  return created({ id, slug });
}
