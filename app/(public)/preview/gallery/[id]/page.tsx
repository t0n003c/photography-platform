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

// Admin-only live preview of a gallery (any status/visibility), rendering its
// photos with the resolved layout — including the editor's unsaved `__pc` draft.
// Wrapped in public chrome for a faithful preview; non-admins get a 404.
export default async function GalleryPreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { id } = await params;
  const rows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  const g = rows[0];
  if (!g) notFound();

  const [{ photos }, layout] = await Promise.all([
    getGalleryPhotos(g.id),
    resolveRenderConfig("gallery", g.pageConfigId, await searchParams, "justified"),
  ]);

  return (
    <Container className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{g.title}</h1>
      {g.description && (
        <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
          {g.description}
        </p>
      )}
      <div className="mt-8">
        {photos.length === 0 ? (
          <p className="text-[hsl(var(--muted-foreground))]">This gallery is empty.</p>
        ) : (
          <Gallery photos={photos} layout={layout} />
        )}
      </div>
    </Container>
  );
}
