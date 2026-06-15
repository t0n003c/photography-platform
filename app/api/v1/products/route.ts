import { eq } from "drizzle-orm";
import { ok } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { product } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET /api/v1/products — public list of active products (store stub).
export async function GET() {
  const data = await db
    .select()
    .from(product)
    .where(eq(product.isActive, true));
  return ok({ data });
}
