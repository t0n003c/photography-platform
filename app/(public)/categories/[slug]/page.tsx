import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getCategoryBySlug,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import { resolveRenderConfig } from "@/src/lib/render-config";
import { buildMetadata, breadcrumbJsonLd, imageGalleryJsonLd } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return buildMetadata({ title: "Category", path: `/categories/${slug}` });
  return buildMetadata({
    title: cat.name,
    description: cat.description ?? `${cat.name} photography.`,
    path: `/categories/${slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) notFound();

  const [{ photos, nextCursor }, layout] = await Promise.all([
    getCategoryPhotos(cat.id),
    resolveRenderConfig("category", null, await searchParams, "masonry"),
  ]);

  return (
    <Container className="py-12">
      <nav className="text-sm text-[hsl(var(--muted-foreground))]">
        <Link href="/categories" className="hover:underline">
          Categories
        </Link>{" "}
        / <span className="text-[hsl(var(--foreground))]">{cat.name}</span>
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{cat.name}</h1>
      {cat.description && (
        <p className="mt-2 max-w-2xl text-[hsl(var(--muted-foreground))]">
          {cat.description}
        </p>
      )}

      <div className="mt-8">
        {photos.length === 0 ? (
          <p className="text-[hsl(var(--muted-foreground))]">
            No photos here yet.
          </p>
        ) : (
          <Gallery
            photos={photos}
            layout={layout}
            initialCursor={nextCursor}
            loadMoreUrl={`/api/v1/categories/${slug}/photos`}
          />
        )}
      </div>

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Categories", path: "/categories" },
          { name: cat.name, path: `/categories/${slug}` },
        ])}
      />
      {photos.length > 0 && (
        <JsonLd
          data={imageGalleryJsonLd({
            name: cat.name,
            path: `/categories/${slug}`,
            images: photos.flatMap((p) =>
              p.variants.filter((v) => v.sizeBucket === "large").map((v) => v.url),
            ),
          })}
        />
      )}
    </Container>
  );
}
