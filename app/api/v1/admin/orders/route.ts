import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { listOrdersAdmin } from "@/src/db/queries/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const data = await listOrdersAdmin();
  return ok({ data });
}
