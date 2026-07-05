import { ok, notFound } from "@/src/lib/http";
import { getActiveProductById } from "@/src/db/queries/store";

export const dynamic = "force-dynamic";

// GET /api/v1/products/{id} — public single active product (store stub).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const product = await getActiveProductById(id);
  if (!product) return notFound();
  return ok({ product });
}
