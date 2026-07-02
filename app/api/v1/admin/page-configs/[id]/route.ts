import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { pageConfig } from "@/src/db/schema";
import { invalidate, CACHE_KEYS } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  gridType: z
    .enum([
      "masonry",
      "justified",
      "uniform",
      "horizontal-lenis",
      "parallax-ring",
      "image-trail",
      "rotating-scroll",
      "diagonal-slideshow",
      "depth-gallery",
      "infinite-canvas",
      "css-glitch",
      "palmer-draggable",
      "carousel-3d-scroll",
      "alternative-scroll",
    ])
    .nullable()
    .optional(),
  spacing: z.string().nullable().optional(),
  theme: z.enum(["light", "dark", "auto"]).nullable().optional(),
  hero: z.unknown().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  layoutId: z.string().nullable().optional(),
});

async function loadConfig(id: string) {
  const rows = await db
    .select()
    .from(pageConfig)
    .where(eq(pageConfig.id, id))
    .limit(1);
  return rows[0] ?? null;
}

// GET — page config detail.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await loadConfig(id);
  if (!row) return notFound();
  return ok(row);
}

// PATCH — update a page config.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const current = await loadConfig(id);
  if (!current) return notFound();

  const updates: Partial<typeof pageConfig.$inferInsert> = {};
  if (body.gridType !== undefined) updates.gridType = body.gridType;
  if (body.spacing !== undefined) updates.spacing = body.spacing;
  if (body.theme !== undefined) updates.theme = body.theme;
  if (body.hero !== undefined) updates.hero = body.hero;
  if (body.config !== undefined) updates.config = body.config;
  if (body.layoutId !== undefined) updates.layoutId = body.layoutId;

  await db.update(pageConfig).set(updates).where(eq(pageConfig.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "pageconfig.update",
    entityType: "page_config",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  await invalidate(CACHE_KEYS.pageConfig(current.scope));
  return ok({ id });
}
