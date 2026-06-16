import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { folder, folderPhoto, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

const IdsSchema = z.object({ photoIds: z.array(z.string().min(1)).min(1) });
const OrderSchema = z.object({
  items: z.array(z.object({ photoId: z.string(), sortOrder: z.number().int() })),
});

async function folderExists(id: string) {
  const r = await db
    .select({ id: folder.id })
    .from(folder)
    .where(eq(folder.id, id))
    .limit(1);
  return r.length > 0;
}

// GET — photos in the folder, in order.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ photo })
    .from(folderPhoto)
    .innerJoin(photo, eq(folderPhoto.photoId, photo.id))
    .where(and(eq(folderPhoto.folderId, id), isNull(photo.deletedAt)))
    .orderBy(asc(folderPhoto.sortOrder), asc(photo.id));

  const data = await serializePhotos(rows.map((r) => r.photo));
  return ok({ data });
}

// POST — add photos (appended after the current max sort order).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  if (!(await folderExists(id))) return notFound();

  const parsed = await parseJson(req, IdsSchema);
  if ("error" in parsed) return parsed.error;

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${folderPhoto.sortOrder}), -1)` })
    .from(folderPhoto)
    .where(eq(folderPhoto.folderId, id));
  let next = (maxRow[0]?.max ?? -1) + 1;

  for (const photoId of parsed.data.photoIds) {
    await db
      .insert(folderPhoto)
      .values({ folderId: id, photoId, sortOrder: next++ })
      .onConflictDoNothing();
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.add_photos",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ added: parsed.data.photoIds.length });
}

// DELETE — remove photos from the folder.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, IdsSchema);
  if ("error" in parsed) return parsed.error;

  await db
    .delete(folderPhoto)
    .where(
      and(
        eq(folderPhoto.folderId, id),
        inArray(folderPhoto.photoId, parsed.data.photoIds),
      ),
    );

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.remove_photos",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ removed: parsed.data.photoIds.length });
}

// PUT — reorder: set sortOrder for the given photos.
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, OrderSchema);
  if ("error" in parsed) return parsed.error;

  await db.transaction(async (tx) => {
    for (const it of parsed.data.items) {
      await tx
        .update(folderPhoto)
        .set({ sortOrder: it.sortOrder })
        .where(
          and(
            eq(folderPhoto.folderId, id),
            eq(folderPhoto.photoId, it.photoId),
          ),
        );
    }
  });

  return ok({ reordered: parsed.data.items.length });
}
