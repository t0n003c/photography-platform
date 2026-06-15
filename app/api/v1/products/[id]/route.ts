import { and, eq } from "drizzle-orm";
import { ok, notFound } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { product } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET /api/v1/products/{id} — public single active product (store stub).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(product)
    .where(and(eq(product.id, id), eq(product.isActive, true)))
    .limit(1);
  if (!rows[0]) return notFound();
  return ok({ product: rows[0] });
}
