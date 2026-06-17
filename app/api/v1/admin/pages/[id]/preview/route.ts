import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { getPageByIdAdmin, savePageDraft } from "@/src/db/queries/pages";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  blocks: z.array(z.unknown()),
  theme: z.enum(["light", "dark", "auto"]).nullable().optional(),
});

// POST — stash the editor's current (unsaved) blocks in a short-lived draft so
// the preview iframe can render them. Admin-only.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await getPageByIdAdmin(id);
  if (!row) return notFound();

  const parsed = await parseJson(req, BodySchema);
  if ("error" in parsed) return parsed.error;

  await savePageDraft(id, { blocks: parsed.data.blocks, theme: parsed.data.theme ?? null });
  return ok({ ok: true });
}
