import Link from "next/link";
import { Container } from "@/components/ui/container";
import { HeroMedia } from "@/components/webgl/hero-media";
import { getFeaturedPhotos } from "@/src/db/queries/public";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type BannerData = Extract<LeafBlock, { type: "banner" }>;

const HEIGHTS: Record<BannerData["height"], string> = {
  short: "h-[48vh]",
  tall: "h-[72vh]",
  full: "h-[88vh]",
};

function Overlay({ block }: { block: BannerData }) {
  return (
    <>
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 flex items-end">
        <Container className="pb-12">
          {block.headline && (
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              {block.headline}
            </h1>
          )}
          {block.subhead && (
            <p className="mt-3 max-w-xl text-base text-white/85">
              {block.subhead}
            </p>
          )}
          {block.ctaLabel && block.ctaHref && (
            <div className="mt-6">
              <Link
                href={block.ctaHref}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
              >
                {block.ctaLabel}
              </Link>
            </div>
          )}
        </Container>
      </div>
    </>
  );
}

// Full-bleed banner. WebGL distortion (effect=webgl-distortion) lands in Phase
// D; here it renders the standard graceful HeroMedia (static image + optional
// canvas enhancement) or a solid band when no photo is set.
export async function BannerBlock({
  block,
  photo,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
}) {
  const h = HEIGHTS[block.height];
  let resolved = photo;
  if (block.source === "featured" && !resolved) {
    try {
      resolved = (await getFeaturedPhotos(1))[0];
    } catch {
      resolved = undefined;
    }
  }
  if (!resolved) {
    return (
      <section className={`relative ${h} w-full bg-[hsl(var(--muted))]`}>
        <Overlay block={block} />
      </section>
    );
  }
  return (
    <section className="relative">
      <HeroMedia photo={resolved} className={`${h} w-full`}>
        <Overlay block={block} />
      </HeroMedia>
    </section>
  );
}
