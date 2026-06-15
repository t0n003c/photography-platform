import { and, eq, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db/client";
import { gallery, galleryAccessGrant, pageConfig } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import { cookieName, verifyGallerySession } from "@/src/auth/gallery-session";
import { ok, notFound, forbidden, problem } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token — gallery metadata, permissions and resolved page config
// for a share-token client. Lock check gates password-protected grants.
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

  // Touch the grant: bump access stats.
  await db
    .update(galleryAccessGrant)
    .set({
      lastAccessedAt: new Date(),
      accessCount: sql`${galleryAccessGrant.accessCount} + 1`,
    })
    .where(eq(galleryAccessGrant.id, grant.id));

  const grows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, grant.galleryId), isNull(gallery.deletedAt)))
    .limit(1);
  const g = grows[0];
  if (!g) return notFound();

  // Resolve the page config: the gallery's explicit one, else the default
  // gallery-scope config.
  let cfg = null;
  if (g.pageConfigId) {
    const crows = await db
      .select()
      .from(pageConfig)
      .where(eq(pageConfig.id, g.pageConfigId))
      .limit(1);
    cfg = crows[0] ?? null;
  }
  if (!cfg) {
    const crows = await db
      .select()
      .from(pageConfig)
      .where(and(eq(pageConfig.scope, "gallery"), eq(pageConfig.isDefault, true)))
      .limit(1);
    cfg = crows[0] ?? null;
  }

  return ok({
    gallery: {
      id: g.id,
      title: g.title,
      description: g.description,
      downloadEnabled: g.downloadEnabled,
    },
    permissions: {
      view: grant.canView,
      favorite: grant.canFavorite,
      download: grant.canDownload,
    },
    pageConfig: cfg,
  });
}
