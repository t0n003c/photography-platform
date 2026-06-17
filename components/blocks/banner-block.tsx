import Link from "next/link";
import { Container } from "@/components/ui/container";
import { HeroMedia } from "@/components/webgl/hero-media";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
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
  // Darkening for text legibility, controlled per banner:
  //   auto → bottom gradient only when there's text (keeps true colors up top)
  //   none → never darken
  //   dark → always apply a stronger scrim (busy/bright photos)
  const hasText = Boolean(
    block.headline || block.subhead || (block.ctaLabel && block.ctaHref),
  );
  const mode = block.overlay ?? "auto";
  const showScrim = mode === "dark" || (mode === "auto" && hasText);
  const scrimClass =
    mode === "dark"
      ? "bg-gradient-to-t from-black/75 via-black/30 to-black/10"
      : "bg-gradient-to-t from-black/60 via-black/10 to-transparent";
  return (
    <>
      {showScrim && <div className={`absolute inset-0 ${scrimClass}`} />}
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
  // The WebGL distortion effect mounts a canvas; "none" renders a clean static
  // image so it isn't darkened by a canvas vignette the user didn't ask for.
  if (block.effect === "webgl-distortion") {
    return (
      <section className="relative">
        <HeroMedia photo={resolved} className={`${h} w-full`} variant="distort">
          <Overlay block={block} />
        </HeroMedia>
      </section>
    );
  }
  return (
    <section className={`relative ${h} w-full overflow-hidden`}>
      <ResponsiveImage
        photo={resolved}
        sizes="100vw"
        priority
        className="absolute inset-0 h-full w-full object-cover"
      />
      <Overlay block={block} />
    </section>
  );
}
