import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { gallery, galleryPhoto, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

// GET — the gallery's photos in order (admin; includes pending photos), so the
// editor can show current membership.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ photo, sortOrder: galleryPhoto.sortOrder })
    .from(galleryPhoto)
    .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
    .where(and(eq(galleryPhoto.galleryId, id), isNull(photo.deletedAt)))
    .orderBy(asc(galleryPhoto.sortOrder), asc(photo.id));

  const data = await serializePhotos(rows.map((r) => r.photo));
  return ok({ data });
}

const PutSchema = z.object({
  items: z.array(
    z.object({
      photoId: z.string().min(1),
      sortOrder: z.number().int(),
    }),
  ),
});

// PUT — replace gallery photo membership in bulk.
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PutSchema);
  if ("error" in parsed) return parsed.error;
  const { items } = parsed.data;

  const exists = await db
    .select({ id: gallery.id })
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  if (!exists.length) return notFound();

  await db.transaction(async (tx) => {
    await tx.delete(galleryPhoto).where(eq(galleryPhoto.galleryId, id));
    if (items.length) {
      await tx.insert(galleryPhoto).values(
        items.map((it) => ({
          galleryId: id,
          photoId: it.photoId,
          sortOrder: it.sortOrder,
        })),
      );
    }
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "gallery.set_photos",
    entityType: "gallery",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: items.length },
  });

  return ok({ count: items.length });
}
