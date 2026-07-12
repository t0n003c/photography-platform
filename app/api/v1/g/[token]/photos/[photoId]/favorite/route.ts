import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { favorite } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { ok, notFound } from "@/src/lib/http";
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
  const resolved = await requireClientGalleryAccess(token, {
    permission: "favorite",
  });
  if ("res" in resolved) return { res: resolved.res };
  const { grant } = resolved.access;
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
