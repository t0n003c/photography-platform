import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { collection } from "@/src/db/schema";
import { ok } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public list of published categories (collections).
export async function GET() {
  const rows = await db
    .select({
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      description: collection.description,
      sortOrder: collection.sortOrder,
      coverPhotoId: collection.coverPhotoId,
    })
    .from(collection)
    .where(eq(collection.isPublished, true))
    .orderBy(asc(collection.sortOrder), asc(collection.name));

  return ok({ data: rows });
}
