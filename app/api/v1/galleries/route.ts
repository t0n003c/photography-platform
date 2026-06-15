import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";
import { ok } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public list of published, public, non-deleted galleries.
export async function GET() {
  const rows = await db
    .select({
      id: gallery.id,
      slug: gallery.slug,
      title: gallery.title,
      description: gallery.description,
      coverPhotoId: gallery.coverPhotoId,
      publishedAt: gallery.publishedAt,
    })
    .from(gallery)
    .where(
      and(
        eq(gallery.visibility, "public"),
        eq(gallery.status, "published"),
        isNull(gallery.deletedAt),
      ),
    )
    .orderBy(desc(gallery.publishedAt));

  return ok({ data: rows });
}
