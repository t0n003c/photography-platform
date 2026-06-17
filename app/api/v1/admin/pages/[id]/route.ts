import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { requireRole, requireFreshAuth } from "@/src/auth/session";
import { ok, noContent, notFound, conflict, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { page } from "@/src/db/schema";
import {
  getPageByIdAdmin,
  clearOtherHomeFlags,
  RESERVED_SLUGS,
} from "@/src/db/queries/pages";
import { parseBlocks } from "@/src/lib/blocks";

export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

const PatchSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  slug: z.string().min(1).max(160).optional(),
  type: z.enum(["standard", "portfolio", "landing", "about", "journal", "contact"]).optional(),
  status: z.enum(["draft", "published"]).optional(),
  isHome: z.boolean().optional(),
  blocks: z.array(z.unknown()).optional(),
  theme: z.enum(["light", "dark", "auto"]).nullable().optional(),
  seoTitle: z.string().max(200).nullable().optional(),
  seoDescription: z.string().max(400).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await getPageByIdAdmin(id);
  if (!row) return notFound();
  return ok({ data: row });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getPageByIdAdmin(id);
  if (!current) return notFound();

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const updates: Partial<typeof page.$inferInsert> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.type !== undefined) updates.type = body.type;
  if (body.theme !== undefined) updates.theme = body.theme;
  if (body.seoTitle !== undefined) updates.seoTitle = body.seoTitle;
  if (body.seoDescription !== undefined) updates.seoDescription = body.seoDescription;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isHome !== undefined) updates.isHome = body.isHome;

  if (body.slug !== undefined && body.slug !== current.slug) {
    if (!SLUG_RE.test(body.slug)) {
      return problem(422, "BAD_SLUG", "Use lowercase letters, numbers and hyphens.");
    }
    if (RESERVED_SLUGS.has(body.slug.split("/")[0])) {
      return problem(422, "RESERVED_SLUG", "That URL is reserved by the site.");
    }
    const taken = await db
      .select({ id: page.id })
      .from(page)
      .where(and(eq(page.slug, body.slug), ne(page.id, id)))
      .limit(1);
    if (taken.length) return conflict("SLUG_TAKEN", "That URL is already in use.");
    updates.slug = body.slug;
  }

  // Blocks are validated + normalized (invalid blocks dropped) before storing.
  if (body.blocks !== undefined) updates.blocks = parseBlocks(body.blocks);

  // Publishing stamps publishedAt the first time.
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "published" && !current.publishedAt) {
      updates.publishedAt = new Date();
    }
  }

  await db.update(page).set(updates).where(eq(page.id, id));
  // Enforce single home page.
  if (body.isHome === true) await clearOtherHomeFlags(id);

  await writeAudit({
    actorId: a.session.user.id,
    action: "page.update",
    entityType: "page",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — step-up required (removes a page permanently).
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireFreshAuth("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const current = await getPageByIdAdmin(id);
  if (!current) return notFound();
  if (current.isHome) {
    return problem(422, "IS_HOME", "Unset Home before deleting this page.");
  }

  await db.delete(page).where(eq(page.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "page.delete",
    entityType: "page",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
