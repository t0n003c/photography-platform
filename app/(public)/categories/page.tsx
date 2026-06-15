import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import {
  getPublishedCategories,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  title: "Categories",
  description: "Browse the portfolio by category.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await getPublishedCategories();
  const withCovers = await Promise.all(
    categories.map(async (c) => {
      const { photos } = await getCategoryPhotos(c.id, null, 1);
      return { ...c, cover: photos[0] ?? null };
    }),
  );

  return (
    <Container className="py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Categories</h1>
      {withCovers.length === 0 ? (
        <p className="mt-6 text-[hsl(var(--muted-foreground))]">
          No categories published yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withCovers.map((c) => (
            <Link
              key={c.id}
              href={`/categories/${c.slug}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl border bg-[hsl(var(--muted))]"
            >
              {c.cover && (
                <ResponsiveImage
                  photo={c.cover}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              )}
              <div className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-4">
                <span className="text-xl font-medium text-white">{c.name}</span>
                {c.description && (
                  <p className="mt-0.5 line-clamp-1 text-sm text-white/80">
                    {c.description}
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
