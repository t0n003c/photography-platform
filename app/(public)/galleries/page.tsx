import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import {
  getGalleryPhotos,
  getPublicGalleries,
} from "@/src/db/queries/public";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  title: "Galleries",
  description: "Browse public photo galleries.",
  path: "/galleries",
});

export default async function GalleriesPage() {
  const galleries = await getPublicGalleries();
  const withCovers = await Promise.all(
    galleries.map(async (gallery) => {
      const { photos } = await getGalleryPhotos(gallery.id, null, 1);
      return { ...gallery, cover: photos[0] ?? null };
    }),
  );

  return (
    <Container className="py-12 sm:py-16">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Galleries</h1>
        <p className="mt-3 text-[hsl(var(--muted-foreground))]">
          Published stories and complete sets from recent work.
        </p>
      </div>

      {withCovers.length === 0 ? (
        <p className="mt-8 text-[hsl(var(--muted-foreground))]">
          No public galleries published yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withCovers.map((gallery) => (
            <Link
              key={gallery.id}
              href={`/galleries/${gallery.slug}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg border bg-[hsl(var(--muted))]"
            >
              {gallery.cover && (
                <ResponsiveImage
                  photo={gallery.cover}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              )}
              <div className="relative z-10 w-full bg-gradient-to-t from-black/65 to-transparent p-4">
                <span className="text-xl font-medium text-white">
                  {gallery.title}
                </span>
                {gallery.subtitle && (
                  <p className="mt-0.5 text-sm text-white/90">
                    {gallery.subtitle}
                  </p>
                )}
                {gallery.description && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-white/80">
                    {gallery.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
