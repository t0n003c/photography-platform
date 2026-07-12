import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { buildSeoAudit } from "@/src/lib/seo-audit";

export const dynamic = "force-dynamic";

// GET /api/v1/admin/seo - read-only SEO Center audit data.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const audit = await buildSeoAudit();
  return ok(audit);
}
