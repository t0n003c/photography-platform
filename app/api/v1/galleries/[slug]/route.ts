import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { gallery, pageConfig } from "@/src/db/schema";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public detail for one published gallery, with resolved page-config.
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const rows = await db
    .select({
      id: gallery.id,
      slug: gallery.slug,
      title: gallery.title,
      subtitle: gallery.subtitle,
      description: gallery.description,
      coverPhotoId: gallery.coverPhotoId,
      publishedAt: gallery.publishedAt,
      pageConfigId: gallery.pageConfigId,
    })
    .from(gallery)
    .where(
      and(
        eq(gallery.slug, slug),
        eq(gallery.visibility, "public"),
        eq(gallery.status, "published"),
        isNull(gallery.deletedAt),
      ),
    )
    .limit(1);

  const g = rows[0];
  if (!g) return notFound();

  const cfgRows = g.pageConfigId
    ? await db
        .select()
        .from(pageConfig)
        .where(eq(pageConfig.id, g.pageConfigId))
        .limit(1)
    : await db
        .select()
        .from(pageConfig)
        .where(and(eq(pageConfig.scope, "gallery"), eq(pageConfig.isDefault, true)))
        .limit(1);

  const { pageConfigId: _pageConfigId, ...galleryDto } = g;
  return ok({ gallery: galleryDto, pageConfig: cfgRows[0] ?? null });
}
