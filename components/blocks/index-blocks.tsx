import Link from "next/link";
import { Instagram } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import {
  getPublishedCategories,
  getPublishedLocations,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import { resolveInstagramProvider, type InstagramProvider } from "@/src/instagram";
import type { LeafBlock } from "@/src/lib/blocks";

const GRID_SIZES = "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw";

function SectionHeading({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <Link
        href={href}
        className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

export async function CategoryIndexBlock({
  block,
}: {
  block: Extract<LeafBlock, { type: "categoryIndex" }>;
}) {
  const categories = await getPublishedCategories();
  if (categories.length === 0) return null;
  const covers = await Promise.all(
    categories.map(async (c) => {
      const { photos } = await getCategoryPhotos(c.id, null, 1);
      return { ...c, cover: photos[0] ?? null };
    }),
  );
  return (
    <Container className="py-16">
      <SectionHeading title={block.title} href="/categories" cta="Browse all" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {covers.map((c) => (
          <Link
            key={c.id}
            href={`/categories/${c.slug}`}
            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg border bg-[hsl(var(--muted))]"
          >
            {c.cover && (
              <ResponsiveImage
                photo={c.cover}
                sizes={GRID_SIZES}
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            )}
            <span className="relative z-10 bg-gradient-to-t from-black/60 to-transparent p-4 text-lg font-medium text-white">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

export async function LocationIndexBlock({
  block,
}: {
  block: Extract<LeafBlock, { type: "locationIndex" }>;
}) {
  const locations = await getPublishedLocations();
  if (locations.length === 0) return null;
  return (
    <Container className="py-16">
      <SectionHeading title={block.title} href="/locations" cta="Browse all" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {locations.map((l) => (
          <Link
            key={l.id}
            href={`/locations/${l.slug}`}
            className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-lg border bg-[hsl(var(--muted))] p-4"
          >
            <span className="text-lg font-medium">{l.name}</span>
          </Link>
        ))}
      </div>
    </Container>
  );
}

export async function InstagramBlock({
  block,
}: {
  block: Extract<LeafBlock, { type: "instagram" }>;
}) {
  let feed: Awaited<ReturnType<InstagramProvider["getFeed"]>> = [];
  try {
    const provider = await resolveInstagramProvider();
    feed = await provider.getFeed(block.count);
  } catch {
    feed = [];
  }
  if (feed.length === 0) return null;
  return (
    <Container className="py-16">
      <div className="flex items-end justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Instagram className="h-6 w-6" /> {block.title}
        </h2>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {feed.map((item) => (
          <a
            key={item.id}
            href={item.permalink}
            target={item.permalink.startsWith("http") ? "_blank" : undefined}
            rel={item.permalink.startsWith("http") ? "noreferrer noopener" : undefined}
            className="relative aspect-square overflow-hidden rounded-md bg-[hsl(var(--muted))]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt={item.caption ?? block.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </a>
        ))}
      </div>
    </Container>
  );
}
