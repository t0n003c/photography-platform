import { asc } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { layout } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET — layout catalog.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const rows = await db.select().from(layout).orderBy(asc(layout.key));
  return ok({ data: rows });
}
