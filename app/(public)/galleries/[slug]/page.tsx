import { notFound } from "next/navigation";
import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getPublicGalleryBySlug,
  getGalleryPhotos,
} from "@/src/db/queries/public";
import { resolveRenderConfig } from "@/src/lib/render-config";
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const g = await getPublicGalleryBySlug(slug);
  if (!g) notFound();

  const [{ photos, nextCursor }, layout] = await Promise.all([
    getGalleryPhotos(g.id),
    resolveRenderConfig("gallery", g.pageConfigId, await searchParams, "justified"),
  ]);
  const isImmersiveLayout =
    layout.gridType === "alternative-scroll" ||
    layout.gridType === "parallax-ring" ||
    layout.gridType === "image-trail" ||
    layout.gridType === "rotating-scroll" ||
    layout.gridType === "diagonal-slideshow" ||
    layout.gridType === "depth-gallery" ||
    layout.gridType === "infinite-canvas" ||
    layout.gridType === "css-glitch" ||
    layout.gridType === "palmer-draggable" ||
    layout.gridType === "tora-sliphover" ||
    layout.gridType === "tora-justified-showcase";

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
          <p className="text-[hsl(var(--muted-foreground))]">
            This gallery is empty.
          </p>
        ) : (
          <Gallery
            photos={photos}
            layout={layout}
            initialCursor={nextCursor}
            loadMoreUrl={`/api/v1/galleries/${slug}/photos`}
            collection={{
              name: g.title,
              subtitle: g.subtitle,
              slug,
              kind: "gallery",
            }}
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
