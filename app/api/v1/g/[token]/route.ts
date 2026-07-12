import { and, eq, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { galleryAccessGrant, pageConfig } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { ok } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token — gallery metadata, permissions and resolved page config
// for a share-token client. Lock check gates password-protected grants.
export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, { permission: "view" });
  if ("res" in resolved) return resolved.res;
  const { grant, gallery: g } = resolved.access;

  // Touch the grant: bump access stats.
  await db
    .update(galleryAccessGrant)
    .set({
      lastAccessedAt: new Date(),
      accessCount: sql`${galleryAccessGrant.accessCount} + 1`,
    })
    .where(eq(galleryAccessGrant.id, grant.id));

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
      subtitle: g.subtitle,
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
