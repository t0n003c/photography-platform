import { ok } from "@/src/lib/http";
import { listProductsPublic } from "@/src/db/queries/store";

export const dynamic = "force-dynamic";

// GET /api/v1/products — public list of active products (store stub).
export async function GET() {
  const data = await listProductsPublic({ limit: 48 });
  return ok({ data });
}
