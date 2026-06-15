import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { collection } from "@/src/db/schema";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public detail for one published category.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
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
    .where(and(eq(collection.slug, slug), eq(collection.isPublished, true)))
    .limit(1);

  const row = rows[0];
  if (!row) return notFound();
  return ok(row);
}
