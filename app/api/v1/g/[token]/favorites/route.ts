import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db/client";
import { favorite, photo } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import { cookieName, verifyGallerySession } from "@/src/auth/gallery-session";
import { ok, notFound, forbidden, problem } from "@/src/lib/http";
import { serializePhotos } from "@/src/db/queries/photos";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token/favorites — the photos this grant has favorited.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const grant = await resolveGrant(token);
  if (!grant) return notFound();
  if (!grant.canView) return forbidden();

  if (grant.passwordHash) {
    const cookie = (await cookies()).get(cookieName(grant.id))?.value;
    if (!verifyGallerySession(cookie, grant.id)) {
      return problem(401, "GALLERY_LOCKED", "This gallery is password protected.");
    }
  }

  const rows = await db
    .select({ photo })
    .from(favorite)
    .innerJoin(photo, eq(favorite.photoId, photo.id))
    .where(and(eq(favorite.grantId, grant.id), isNull(photo.deletedAt)));

  const data = (await serializePhotos(rows.map((r) => r.photo))).map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      url: `${v.url}?t=${encodeURIComponent(token)}`,
    })),
  }));
  return ok({ data });
}
