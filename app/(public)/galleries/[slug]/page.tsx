import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getPublicGalleryBySlug,
  getGalleryPhotos,
  resolvePageConfig,
} from "@/src/db/queries/public";
import { buildMetadata, imageGalleryJsonLd } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getPublicGalleryBySlug(slug);
  if (!g) return buildMetadata({ title: "Gallery", path: `/galleries/${slug}` });
  return buildMetadata({
    title: g.title,
    description: g.description ?? undefined,
    path: `/galleries/${slug}`,
  });
}

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const g = await getPublicGalleryBySlug(slug);
  if (!g) notFound();

  const [{ photos, nextCursor }, cfg] = await Promise.all([
    getGalleryPhotos(g.id),
    resolvePageConfig("gallery", g.pageConfigId),
  ]);

  const layout = {
    gridType: (cfg?.gridType ?? "justified") as
      | "masonry"
      | "justified"
      | "uniform",
    spacing: cfg?.spacing ?? "normal",
  };

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
          <p className="text-[hsl(var(--muted-foreground))]">
            This gallery is empty.
          </p>
        ) : (
          <Gallery
            photos={photos}
            layout={layout}
            initialCursor={nextCursor}
            loadMoreUrl={`/api/v1/galleries/${slug}/photos`}
          />
        )}
      </div>

      {photos.length > 0 && (
        <JsonLd
          data={imageGalleryJsonLd({
            name: g.title,
            path: `/galleries/${slug}`,
            images: photos.flatMap((p) =>
              p.variants.filter((v) => v.sizeBucket === "large").map((v) => v.url),
            ),
          })}
        />
      )}
    </Container>
  );
}
