import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Gallery } from "@/components/gallery/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getLocationBySlug,
  getLocationPhotos,
} from "@/src/db/queries/public";
import { resolveRenderConfig } from "@/src/lib/render-config";
import { buildMetadata, breadcrumbJsonLd } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loc = await getLocationBySlug(slug);
  if (!loc) return buildMetadata({ title: "Location", path: `/locations/${slug}` });
  return buildMetadata({
    title: loc.name,
    description: `Photography from ${loc.name}${loc.region ? `, ${loc.region}` : ""}.`,
    path: `/locations/${slug}`,
  });
}

export default async function LocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const loc = await getLocationBySlug(slug);
  if (!loc) notFound();

  const [{ photos, nextCursor }, layout] = await Promise.all([
    getLocationPhotos(loc.id),
    resolveRenderConfig("location", null, await searchParams, "justified"),
  ]);

  return (
    <Container className="py-12">
      <nav className="text-sm text-[hsl(var(--muted-foreground))]">
        <Link href="/locations" className="hover:underline">
          Locations
        </Link>{" "}
        / <span className="text-[hsl(var(--foreground))]">{loc.name}</span>
      </nav>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{loc.name}</h1>
      {loc.region && (
        <p className="mt-1 text-[hsl(var(--muted-foreground))]">{loc.region}</p>
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
            loadMoreUrl={`/api/v1/locations/${slug}/photos`}
            collection={{ name: loc.name, slug, kind: "location" }}
          />
        )}
      </div>

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Locations", path: "/locations" },
          { name: loc.name, path: `/locations/${slug}` },
        ])}
      />
    </Container>
  );
}
