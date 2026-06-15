import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, noContent, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import {
  photo,
  galleryPhoto,
  collectionPhoto,
  photoLocation,
} from "@/src/db/schema";
import { loadVariants, serializePhoto } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  altText: z.string().nullable().optional(),
  captureDate: z.string().datetime().nullable().optional(),
});

async function loadActivePhoto(id: string) {
  const rows = await db
    .select()
    .from(photo)
    .where(and(eq(photo.id, id), isNull(photo.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// GET /api/v1/admin/photos/{id} — full photo incl. exif, variants, memberships.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("staff");
  if (a.error) return a.error;

  const { id } = await ctx.params;
  const p = await loadActivePhoto(id);
  if (!p) return notFound();

  const variants = (await loadVariants([id])).get(id) ?? [];
  const [galleries, categories, locations] = await Promise.all([
    db
      .select({ id: galleryPhoto.galleryId })
      .from(galleryPhoto)
      .where(eq(galleryPhoto.photoId, id)),
    db
      .select({ id: collectionPhoto.collectionId })
      .from(collectionPhoto)
      .where(eq(collectionPhoto.photoId, id)),
    db
      .select({ id: photoLocation.locationId })
      .from(photoLocation)
      .where(eq(photoLocation.photoId, id)),
  ]);

  return ok({
    photo: {
      ...serializePhoto(p, variants),
      filename: p.filename,
      mimeType: p.mimeType,
      byteSize: p.byteSize,
      processingStatus: p.processingStatus,
      processingError: p.processingError,
      exif: p.exif,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      memberships: {
        galleries: galleries.map((r) => r.id),
        categories: categories.map((r) => r.id),
        locations: locations.map((r) => r.id),
      },
    },
  });
}

// PATCH /api/v1/admin/photos/{id} — update editable metadata.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("staff");
  if (a.error) return a.error;

  const { id } = await ctx.params;
  const parsed = await parseJson(req, patchSchema);
  if ("error" in parsed) return parsed.error;

  const p = await loadActivePhoto(id);
  if (!p) return notFound();

  const updates: { altText?: string | null; captureDate?: Date | null } = {};
  if ("altText" in parsed.data) updates.altText = parsed.data.altText ?? null;
  if ("captureDate" in parsed.data) {
    updates.captureDate = parsed.data.captureDate
      ? new Date(parsed.data.captureDate)
      : null;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(photo).set(updates).where(eq(photo.id, id));
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "photo.update",
    entityType: "photo",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: updates,
  });

  const variants = (await loadVariants([id])).get(id) ?? [];
  const fresh = (await loadActivePhoto(id)) ?? p;
  return ok({ photo: serializePhoto(fresh, variants) });
}

// DELETE /api/v1/admin/photos/{id} — soft delete.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("staff");
  if (a.error) return a.error;

  const { id } = await ctx.params;
  const p = await loadActivePhoto(id);
  if (!p) return notFound();

  await db.update(photo).set({ deletedAt: new Date() }).where(eq(photo.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "photo.delete",
    entityType: "photo",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
