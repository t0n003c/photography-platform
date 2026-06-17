import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, created, conflict, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { page } from "@/src/db/schema";
import {
  listPagesAdmin,
  ensureCorePagesSeeded,
  ensureHomePageSeeded,
  RESERVED_SLUGS,
} from "@/src/db/queries/pages";
import { getSiteMeta } from "@/src/db/queries/settings";
import { presetBlocks, type PageType } from "@/src/lib/page-presets";

export const dynamic = "force-dynamic";

// GET — all pages for the list view. Seeds the core pages (About published, a
// Home draft reproducing the original homepage) on first visit.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  await ensureCorePagesSeeded();
  const meta = await getSiteMeta();
  await ensureHomePageSeeded({ headline: meta.name, subhead: meta.description });
  const pages = await listPagesAdmin();
  return ok({ data: pages });
}

const SLUG_RE = /^[a-z0-9]+(?:[-/][a-z0-9]+)*$/;

const CreateSchema = z.object({
  title: z.string().min(1).max(160),
  slug: z.string().min(1).max(160),
  type: z.enum(["standard", "portfolio", "landing", "about", "journal", "contact"]),
});

// POST — create a page from a type preset.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const { title, slug, type } = parsed.data;

  if (!SLUG_RE.test(slug)) {
    return problem(422, "BAD_SLUG", "Use lowercase letters, numbers and hyphens.");
  }
  if (RESERVED_SLUGS.has(slug.split("/")[0])) {
    return problem(422, "RESERVED_SLUG", "That URL is reserved by the site.");
  }
  const taken = await db.select({ id: page.id }).from(page).where(eq(page.slug, slug)).limit(1);
  if (taken.length) return conflict("SLUG_TAKEN", "That URL is already in use.");

  let i = 0;
  const id = newId();
  await db.insert(page).values({
    id,
    slug,
    title,
    type: type as PageType,
    status: "draft",
    blocks: presetBlocks(type as PageType, () => `${id}-${i++}`),
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "page.create",
    entityType: "page",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { slug, type },
  });

  return created({ id });
}
