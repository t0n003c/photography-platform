import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/src/auth/session";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";
import { getGalleryPhotos } from "@/src/db/queries/public";
import { resolveRenderConfig } from "@/src/lib/render-config";
import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";

export const dynamic = "force-dynamic";

// Live preview of a gallery rendering its photos with the resolved layout —
// including the editor's unsaved `__pc` draft. Published public galleries may be
// previewed directly; draft/private galleries remain admin-only.
export default async function GalleryPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const { id } = await params;
  const rows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  const g = rows[0];
  if (!g) notFound();
  const isPublishedPublic =
    g.visibility === "public" && g.status === "published";
  if (!session && !isPublishedPublic) notFound();

  const [{ photos }, layout] = await Promise.all([
    getGalleryPhotos(g.id),
    resolveRenderConfig(
      "gallery",
      g.pageConfigId,
      await searchParams,
      "justified",
      { allowDraftPreview: isPublishedPublic || Boolean(session) },
    ),
  ]);
  const isImmersiveLayout =
    layout.gridType === "alternative-scroll" ||
    layout.gridType === "parallax-ring" ||
    layout.gridType === "image-trail";

  return (
    <Container
      className={
        isImmersiveLayout
          ? "max-w-none px-0 py-0 sm:px-0 lg:px-0"
          : "py-12"
      }
    >
      {!isImmersiveLayout && (
        <>
          <h1 className="text-3xl font-semibold tracking-tight">{g.title}</h1>
          {g.subtitle && (
            <p className="mt-1 text-lg text-[hsl(var(--muted-foreground))]">
              {g.subtitle}
            </p>
          )}
          {g.description && (
            <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
              {g.description}
            </p>
          )}
        </>
      )}
      <div className={isImmersiveLayout ? "" : "mt-8"}>
        {photos.length === 0 ? (
          <p className="text-[hsl(var(--muted-foreground))]">This gallery is empty.</p>
        ) : (
          <Gallery
            photos={photos}
            layout={layout}
            collection={{
              name: g.title,
              subtitle: g.subtitle,
              slug: g.slug,
              kind: "gallery",
            }}
          />
        )}
      </div>
    </Container>
  );
}
