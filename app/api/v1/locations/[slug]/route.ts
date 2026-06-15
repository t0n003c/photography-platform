import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { location } from "@/src/db/schema";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public detail for one published location.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const rows = await db
    .select({
      id: location.id,
      slug: location.slug,
      name: location.name,
      region: location.region,
      lat: location.lat,
      lng: location.lng,
      sortOrder: location.sortOrder,
      coverPhotoId: location.coverPhotoId,
    })
    .from(location)
    .where(and(eq(location.slug, slug), eq(location.isPublished, true)))
    .limit(1);

  const row = rows[0];
  if (!row) return notFound();
  return ok(row);
}
