import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { collection, collectionPhoto, photo } from "@/src/db/schema";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

const Body = z.object({ photoIds: z.array(z.string().min(1)).min(1) });
const OrderSchema = z.object({
  items: z.array(z.object({ photoId: z.string(), sortOrder: z.number().int() })),
});

// GET — photos in the category, in display order (first = cover).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ photo })
    .from(collectionPhoto)
    .innerJoin(photo, eq(collectionPhoto.photoId, photo.id))
    .where(and(eq(collectionPhoto.collectionId, id), isNull(photo.deletedAt)))
    .orderBy(asc(collectionPhoto.sortOrder), asc(photo.id));

  const data = await serializePhotos(rows.map((r) => r.photo));
  return ok({ data });
}

// POST — add photos to a category (appended after the current max sort order).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const exists = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.id, id))
    .limit(1);
  if (!exists.length) return notFound();

  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${collectionPhoto.sortOrder}), -1)` })
    .from(collectionPhoto)
    .where(eq(collectionPhoto.collectionId, id));
  let next = (maxRow[0]?.max ?? -1) + 1;

  for (const photoId of parsed.data.photoIds) {
    await db
      .insert(collectionPhoto)
      .values({ collectionId: id, photoId, sortOrder: next++ })
      .onConflictDoNothing();
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "category.add_photos",
    entityType: "collection",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ added: parsed.data.photoIds.length });
}

// DELETE — remove photos from a category.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;

  await db
    .delete(collectionPhoto)
    .where(
      and(
        eq(collectionPhoto.collectionId, id),
        inArray(collectionPhoto.photoId, parsed.data.photoIds),
      ),
    );

  await writeAudit({
    actorId: a.session.user.id,
    action: "category.remove_photos",
    entityType: "collection",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ removed: parsed.data.photoIds.length });
}

// PUT — reorder: set sortOrder for the given photos (first = cover).
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
        .update(collectionPhoto)
        .set({ sortOrder: it.sortOrder })
        .where(
          and(
            eq(collectionPhoto.collectionId, id),
            eq(collectionPhoto.photoId, it.photoId),
          ),
        );
    }
  });

  return ok({ reordered: parsed.data.items.length });
}
