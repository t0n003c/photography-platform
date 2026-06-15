import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, noContent, notFound, conflict, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { collection } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  slug: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  coverPhotoId: z.string().nullable().optional(),
});

// PATCH — update a category.
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

  const rows = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.id, id))
    .limit(1);
  if (!rows.length) return notFound();

  if (body.slug !== undefined) {
    const dup = await db
      .select({ id: collection.id })
      .from(collection)
      .where(and(eq(collection.slug, body.slug), ne(collection.id, id)))
      .limit(1);
    if (dup.length) return conflict("SLUG_TAKEN", "That slug is already in use.");
  }

  const updates: Partial<typeof collection.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished;
  if (body.coverPhotoId !== undefined) updates.coverPhotoId = body.coverPhotoId;

  await db.update(collection).set(updates).where(eq(collection.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "category.update",
    entityType: "collection",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — hard delete a category.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.id, id))
    .limit(1);
  if (!rows.length) return notFound();

  await db.delete(collection).where(eq(collection.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "category.delete",
    entityType: "collection",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
