import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, conflict, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { collection } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
});

// GET — list all categories (collections), sortOrder asc.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const rows = await db
    .select()
    .from(collection)
    .orderBy(asc(collection.sortOrder));

  return ok({ data: rows });
}

// POST — create a category.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const existing = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.slug, body.slug))
    .limit(1);
  if (existing.length) return conflict("SLUG_TAKEN", "That slug is already in use.");

  const id = newId();
  await db.insert(collection).values({
    id,
    slug: body.slug,
    name: body.name,
    description: body.description ?? null,
    sortOrder: body.sortOrder ?? 0,
    isPublished: body.isPublished ?? true,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "category.create",
    entityType: "collection",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { slug: body.slug },
  });

  return created({ id, slug: body.slug });
}
