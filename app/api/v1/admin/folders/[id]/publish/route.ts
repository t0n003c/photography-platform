import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, notFound, conflict, problem, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { invalidate, CACHE_KEYS } from "@/src/lib/cache";
import { db } from "@/src/db/client";
import {
  folder,
  folderPhoto,
  gallery,
  galleryPhoto,
  collection,
  collectionPhoto,
} from "@/src/db/schema";

export const dynamic = "force-dynamic";

const Schema = z.object({
  as: z.enum(["gallery", "category"]),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a url-safe slug (lowercase, hyphens)."),
  title: z.string().min(1).max(160),
});

// POST — snapshot the folder's photos into a public gallery or category.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const f = await db.select().from(folder).where(eq(folder.id, id)).limit(1);
  if (!f.length) return notFound();

  const parsed = await parseJson(req, Schema);
  if ("error" in parsed) return parsed.error;
  const { as, slug, title } = parsed.data;

  const photos = await db
    .select({ photoId: folderPhoto.photoId, sortOrder: folderPhoto.sortOrder })
    .from(folderPhoto)
    .where(eq(folderPhoto.folderId, id))
    .orderBy(asc(folderPhoto.sortOrder));
  if (photos.length === 0) {
    return problem(422, "EMPTY_FOLDER", "This folder has no photos to publish.");
  }

  if (as === "gallery") {
    const existing = await db
      .select({ id: gallery.id })
      .from(gallery)
      .where(eq(gallery.slug, slug))
      .limit(1);
    if (existing.length) return conflict("SLUG_TAKEN", "Gallery slug is taken.");

    const gid = newId();
    await db.transaction(async (tx) => {
      await tx.insert(gallery).values({
        id: gid,
        slug,
        title,
        visibility: "public",
        status: "published",
        publishedAt: new Date(),
        ownerId: a.session.user.id,
      });
      await tx.insert(galleryPhoto).values(
        photos.map((p, i) => ({
          galleryId: gid,
          photoId: p.photoId,
          sortOrder: i,
        })),
      );
    });

    await writeAudit({
      actorId: a.session.user.id,
      action: "folder.publish",
      entityType: "folder",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
      metadata: { as, galleryId: gid, count: photos.length },
    });
    return created({ as, id: gid, slug, url: `/galleries/${slug}` });
  }

  // as === "category"
  const existing = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.slug, slug))
    .limit(1);
  if (existing.length) return conflict("SLUG_TAKEN", "Category slug is taken.");

  const cid = newId();
  await db.transaction(async (tx) => {
    await tx
      .insert(collection)
      .values({ id: cid, slug, name: title, isPublished: true });
    await tx.insert(collectionPhoto).values(
      photos.map((p, i) => ({
        collectionId: cid,
        photoId: p.photoId,
        sortOrder: i,
      })),
    );
  });
  await invalidate(CACHE_KEYS.categories);

  await writeAudit({
    actorId: a.session.user.id,
    action: "folder.publish",
    entityType: "folder",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { as, collectionId: cid, count: photos.length },
  });
  return created({ as, id: cid, slug, url: `/categories/${slug}` });
}
