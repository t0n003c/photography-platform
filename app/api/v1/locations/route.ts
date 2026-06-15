import { asc, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { location } from "@/src/db/schema";
import { ok } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public list of published locations.
export async function GET() {
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
    .where(eq(location.isPublished, true))
    .orderBy(asc(location.sortOrder), asc(location.name));

  return ok({ data: rows });
}
