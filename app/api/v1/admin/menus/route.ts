import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { listMenusForAdmin } from "@/src/db/queries/menus";

export const dynamic = "force-dynamic";

// GET — all menus with their items (flat, parentId-linked) for the tree editor.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const menus = await listMenusForAdmin();
  return ok({ data: menus });
}
