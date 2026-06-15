import Link from "next/link";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import {
  getPublishedLocations,
  getLocationPhotos,
} from "@/src/db/queries/public";
import { buildMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({
  title: "Locations",
  description: "Browse the portfolio by place.",
  path: "/locations",
});

export default async function LocationsPage() {
  const locations = await getPublishedLocations();
  const withCovers = await Promise.all(
    locations.map(async (l) => {
      const { photos } = await getLocationPhotos(l.id, null, 1);
      return { ...l, cover: photos[0] ?? null };
    }),
  );

  return (
    <Container className="py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Locations</h1>
      {withCovers.length === 0 ? (
        <p className="mt-6 text-[hsl(var(--muted-foreground))]">
          No locations published yet.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withCovers.map((l) => (
            <Link
              key={l.id}
              href={`/locations/${l.slug}`}
              className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-xl border bg-[hsl(var(--muted))]"
            >
              {l.cover && (
                <ResponsiveImage
                  photo={l.cover}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              )}
              <div className="relative z-10 w-full bg-gradient-to-t from-black/60 to-transparent p-4">
                <span className="text-xl font-medium text-white">{l.name}</span>
                {l.region && (
                  <p className="mt-0.5 text-sm text-white/80">{l.region}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
