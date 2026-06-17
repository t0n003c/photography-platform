import Link from "next/link";
import { Instagram } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { HeroMedia } from "@/components/webgl/hero-media";
import { Gallery } from "@/components/gallery/gallery";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getFeaturedPhotos,
  getPublishedCategories,
  getPublishedLocations,
  getCategoryPhotos,
} from "@/src/db/queries/public";
import { getInstagramProvider } from "@/src/instagram";
import { resolveRenderConfig } from "@/src/lib/render-config";
import { buildMetadata, SITE, imageGalleryJsonLd } from "@/src/lib/seo";
import { getHomePage } from "@/src/db/queries/pages";
import { parseBlocks } from "@/src/lib/blocks";
import { BlockRenderer } from "@/components/blocks/block-renderer";

export const dynamic = "force-dynamic";
export const metadata = buildMetadata({ path: "/" });

const GRID_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Once a Home builder page is published, it drives the homepage. Until then
  // the original hand-built home below renders.
  const homePage = await getHomePage();
  if (homePage) {
    return (
      <div className="py-4">
        <BlockRenderer blocks={parseBlocks(homePage.blocks)} />
      </div>
    );
  }

  const [featured, categories, locations, instagram, config] =
    await Promise.all([
      getFeaturedPhotos(13),
      getPublishedCategories(),
      getPublishedLocations(),
      getInstagramProvider().getFeed(6),
      resolveRenderConfig("home", null, await searchParams, "justified"),
    ]);

  const hero = featured[0];
  const rest = featured.slice(1);
  const headline = config.hero?.headline?.trim() || SITE.name;

  return (
    <>
      {/* Hero */}
      <section className="relative">
        {hero ? (
          <HeroMedia photo={hero} className="h-[72vh] w-full">
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 flex items-end">
              <Container className="pb-12">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                  {headline}
                </h1>
                <p className="mt-3 max-w-xl text-base text-white/85">
                  {SITE.description}
                </p>
                <div className="mt-6 flex gap-3">
                  <Link
                    href="/categories"
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    View portfolio
                  </Link>
                  <Link
                    href="/contact"
                    className="rounded-full border border-white/60 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Get in touch
                  </Link>
                </div>
              </Container>
            </div>
          </HeroMedia>
        ) : (
          <Container className="py-24">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              {headline}
            </h1>
            <p className="mt-4 max-w-xl text-[hsl(var(--muted-foreground))]">
              {SITE.description}
            </p>
            <div className="mt-8">
              <Link
                href="/contact"
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Get in touch
              </Link>
            </div>
          </Container>
        )}
      </section>

      {/* Featured */}
      {rest.length > 0 && (
        <Container className="py-16">
          <SectionHeading title="Featured work" href="/categories" cta="All work" />
          <div className="mt-6">
            <Gallery
              photos={rest}
              layout={{ gridType: config.gridType, spacing: config.spacing }}
            />
          </div>
          <JsonLd
            data={imageGalleryJsonLd({
              name: "Featured work",
              path: "/",
              images: rest.flatMap((p) =>
                p.variants.filter((v) => v.sizeBucket === "large").map((v) => v.url),
              ),
            })}
          />
        </Container>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <Container className="py-16">
          <SectionHeading title="By category" href="/categories" cta="Browse all" />
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {await renderCovers(
              categories.map((c) => ({
                href: `/categories/${c.slug}`,
                label: c.name,
                id: c.id,
                kind: "category" as const,
              })),
            )}
          </div>
        </Container>
      )}

      {/* Locations */}
      {locations.length > 0 && (
        <Container className="py-16">
          <SectionHeading title="By location" href="/locations" cta="Browse all" />
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
      )}

      {/* From the field — Instagram feed via InstagramProvider (Graph driver
          when IG_ACCESS_TOKEN is set, recent public photos otherwise). Hidden
          when the feed is empty. */}
      {instagram.length > 0 && (
        <Container className="py-16">
          <div className="flex items-end justify-between">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Instagram className="h-6 w-6" /> From the field
            </h2>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-[hsl(var(--muted-foreground))] underline-offset-4 hover:underline"
            >
              @studio
            </a>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {instagram.map((item) => (
              <a
                key={item.id}
                href={item.permalink}
                target={item.permalink.startsWith("http") ? "_blank" : undefined}
                rel={
                  item.permalink.startsWith("http")
                    ? "noreferrer noopener"
                    : undefined
                }
                className="relative aspect-square overflow-hidden rounded-md bg-[hsl(var(--muted))]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.caption ?? "From the field"}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        </Container>
      )}

      {/* About teaser */}
      <Container className="py-20">
        <div className="rounded-2xl border p-8 sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight">
            Photography that lasts
          </h2>
          <p className="mt-3 max-w-2xl text-[hsl(var(--muted-foreground))]">
            Portraits, events, and the wild places in between — shot and delivered
            with care. Private client galleries, fine-art prints, and a process
            built to make working together effortless.
          </p>
          <Link
            href="/about"
            className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
          >
            More about the studio →
          </Link>
        </div>
      </Container>
    </>
  );
}

function SectionHeading({
  title,
  href,
  cta,
}: {
  title: string;
  href: string;
  cta: string;
}) {
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

// Render category cover cards (one representative photo each).
async function renderCovers(
  items: { href: string; label: string; id: string; kind: "category" }[],
) {
  const covers = await Promise.all(
    items.map(async (it) => {
      const { photos } = await getCategoryPhotos(it.id, null, 1);
      return { ...it, cover: photos[0] ?? null };
    }),
  );
  return covers.map((c) => (
    <Link
      key={c.id}
      href={c.href}
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
        {c.label}
      </span>
    </Link>
  ));
}
