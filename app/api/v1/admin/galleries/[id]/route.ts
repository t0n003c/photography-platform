import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireRole, requireFreshAuth } from "@/src/auth/session";
import { ok, noContent, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  coverPhotoId: z.string().nullable().optional(),
  pageConfigId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  downloadEnabled: z.boolean().optional(),
});

async function loadGallery(id: string) {
  const rows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// GET — gallery detail.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await loadGallery(id);
  if (!row) return notFound();
  return ok(row);
}

// PATCH — update gallery fields.
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

  const current = await loadGallery(id);
  if (!current) return notFound();

  const updates: Partial<typeof gallery.$inferInsert> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.visibility !== undefined) updates.visibility = body.visibility;
  if (body.status !== undefined) updates.status = body.status;
  if (body.coverPhotoId !== undefined) updates.coverPhotoId = body.coverPhotoId;
  if (body.pageConfigId !== undefined) updates.pageConfigId = body.pageConfigId;
  if (body.clientId !== undefined) updates.clientId = body.clientId;
  if (body.downloadEnabled !== undefined)
    updates.downloadEnabled = body.downloadEnabled;
  if (body.expiresAt !== undefined)
    updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (
    body.status === "published" &&
    current.status !== "published" &&
    !current.publishedAt
  ) {
    updates.publishedAt = new Date();
  }

  await db.update(gallery).set(updates).where(eq(gallery.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "gallery.update",
    entityType: "gallery",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — soft delete.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireFreshAuth("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const current = await loadGallery(id);
  if (!current) return notFound();

  await db
    .update(gallery)
    .set({ deletedAt: new Date() })
    .where(eq(gallery.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "gallery.delete",
    entityType: "gallery",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
