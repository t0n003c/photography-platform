import { z } from "zod";
import { eq, and, ne } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, noContent, notFound, conflict, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { location } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  region: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  coverPhotoId: z.string().nullable().optional(),
});

// PATCH — update a location.
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
    .select({ id: location.id })
    .from(location)
    .where(eq(location.id, id))
    .limit(1);
  if (!rows.length) return notFound();

  if (body.slug !== undefined) {
    const dup = await db
      .select({ id: location.id })
      .from(location)
      .where(and(eq(location.slug, body.slug), ne(location.id, id)))
      .limit(1);
    if (dup.length) return conflict("SLUG_TAKEN", "That slug is already in use.");
  }

  const updates: Partial<typeof location.$inferInsert> = {};
  if (body.slug !== undefined) updates.slug = body.slug;
  if (body.name !== undefined) updates.name = body.name;
  if (body.region !== undefined) updates.region = body.region;
  if (body.lat !== undefined) updates.lat = body.lat;
  if (body.lng !== undefined) updates.lng = body.lng;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
  if (body.isPublished !== undefined) updates.isPublished = body.isPublished;
  if (body.coverPhotoId !== undefined) updates.coverPhotoId = body.coverPhotoId;

  await db.update(location).set(updates).where(eq(location.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "location.update",
    entityType: "location",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — hard delete a location.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ id: location.id })
    .from(location)
    .where(eq(location.id, id))
    .limit(1);
  if (!rows.length) return notFound();

  await db.delete(location).where(eq(location.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "location.delete",
    entityType: "location",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
