import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db/client";
import { favorite } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import { cookieName, verifyGallerySession } from "@/src/auth/gallery-session";
import { ok, notFound, forbidden, problem } from "@/src/lib/http";
import { grantAuthorizesPhoto } from "@/src/db/queries/photos";
import { newId } from "@/src/lib/id";
import type { Grant } from "@/src/auth/grant";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string; photoId: string }> };

// Shared gate for both verbs: resolve + lock check + favorite permission +
// photo authorization. Returns the grant, or a Response to short-circuit with.
async function gate(
  token: string,
  photoId: string,
): Promise<{ grant: Grant } | { res: Response }> {
  const grant = await resolveGrant(token);
  if (!grant) return { res: notFound() };
  if (!grant.canView) return { res: forbidden() };

  if (grant.passwordHash) {
    const cookie = (await cookies()).get(cookieName(grant.id))?.value;
    if (!verifyGallerySession(cookie, grant.id)) {
      return {
        res: problem(401, "GALLERY_LOCKED", "This gallery is password protected."),
      };
    }
  }

  if (!grant.canFavorite) return { res: forbidden() };
  if (!(await grantAuthorizesPhoto(grant, photoId))) return { res: notFound() };
  return { grant };
}

// PUT /api/v1/g/:token/photos/:photoId/favorite — idempotent favorite.
export async function PUT(_req: Request, ctx: Ctx) {
  const { token, photoId } = await ctx.params;
  const g = await gate(token, photoId);
  if ("res" in g) return g.res;
  const { grant } = g;

  await db
    .insert(favorite)
    .values({
      id: newId(),
      grantId: grant.id,
      galleryId: grant.galleryId,
      clientId: grant.clientId,
      photoId,
    })
    .onConflictDoNothing({
      target: [favorite.grantId, favorite.photoId],
    });

  return ok({ favorited: true });
}

// DELETE /api/v1/g/:token/photos/:photoId/favorite — idempotent unfavorite.
export async function DELETE(_req: Request, ctx: Ctx) {
  const { token, photoId } = await ctx.params;
  const g = await gate(token, photoId);
  if ("res" in g) return g.res;
  const { grant } = g;

  await db
    .delete(favorite)
    .where(and(eq(favorite.grantId, grant.id), eq(favorite.photoId, photoId)));

  return ok({ favorited: false });
}
