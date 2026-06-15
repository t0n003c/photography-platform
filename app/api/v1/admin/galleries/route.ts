import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, conflict, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  clientId: z.string().optional(),
  downloadEnabled: z.boolean().optional(),
});

// GET — list galleries (?status= &?visibility=, updatedAt desc).
export async function GET(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const visibility = url.searchParams.get("visibility");

  const conds = [isNull(gallery.deletedAt)];
  if (status === "draft" || status === "published" || status === "archived") {
    conds.push(eq(gallery.status, status));
  }
  if (visibility === "public" || visibility === "private") {
    conds.push(eq(gallery.visibility, visibility));
  }

  const rows = await db
    .select()
    .from(gallery)
    .where(and(...conds))
    .orderBy(desc(gallery.updatedAt));

  return ok({ data: rows });
}

// POST — create a gallery.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const existing = await db
    .select({ id: gallery.id })
    .from(gallery)
    .where(eq(gallery.slug, body.slug))
    .limit(1);
  if (existing.length) return conflict("SLUG_TAKEN", "That slug is already in use.");

  const id = newId();
  await db.insert(gallery).values({
    id,
    slug: body.slug,
    title: body.title,
    description: body.description ?? null,
    visibility: body.visibility ?? "private",
    ownerId: a.session.user.id,
    clientId: body.clientId ?? null,
    downloadEnabled: body.downloadEnabled ?? false,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "gallery.create",
    entityType: "gallery",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { slug: body.slug },
  });

  return created({ id, slug: body.slug });
}
