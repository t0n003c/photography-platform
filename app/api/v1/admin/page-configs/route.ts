import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { pageConfig } from "@/src/db/schema";
import { invalidate, CACHE_KEYS } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

const SCOPES = ["home", "gallery", "category", "location", "about", "global"] as const;

const CreateSchema = z.object({
  scope: z.enum(SCOPES),
  layoutId: z.string().optional(),
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
      "tora-sliphover",
      "tora-justified-showcase",
      "carousel-3d-scroll",
      "alternative-scroll",
    ])
    .optional(),
  spacing: z.string().optional(),
  theme: z.enum(["light", "dark", "auto"]).optional(),
  hero: z.unknown().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// GET — list page configs (?scope=).
export async function GET(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");

  const base = db.select().from(pageConfig);
  const rows =
    scope && (SCOPES as readonly string[]).includes(scope)
      ? await base
          .where(eq(pageConfig.scope, scope as (typeof SCOPES)[number]))
          .orderBy(desc(pageConfig.createdAt))
      : await base.orderBy(desc(pageConfig.createdAt));

  return ok({ data: rows });
}

// POST — create a page config.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const id = newId();
  const [row] = await db
    .insert(pageConfig)
    .values({
      id,
      scope: body.scope,
      layoutId: body.layoutId ?? null,
      gridType: body.gridType ?? null,
      spacing: body.spacing ?? null,
      theme: body.theme ?? null,
      hero: body.hero ?? null,
      ...(body.config !== undefined ? { config: body.config } : {}),
    })
    .returning();

  await writeAudit({
    actorId: a.session.user.id,
    action: "pageconfig.create",
    entityType: "page_config",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { scope: body.scope },
  });

  await invalidate(CACHE_KEYS.pageConfig(body.scope));
  return created({ data: row });
}
