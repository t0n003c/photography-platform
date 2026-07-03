import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Play } from "lucide-react";
import { Container } from "@/components/ui/container";
import { HeroMedia } from "@/components/webgl/hero-media";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { CssGlitchImage } from "@/components/gallery/css-glitch";
import { getFeaturedPhotos } from "@/src/db/queries/public";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type BannerData = Extract<LeafBlock, { type: "banner" }>;

const HEIGHTS: Record<BannerData["height"], string> = {
  short: "h-[48vh]",
  tall: "h-[72vh]",
  full: "h-[88vh]",
};
const PRISMA_HEIGHTS: Record<BannerData["height"], string> = {
  short: "min-h-[62svh]",
  tall: "min-h-[76svh]",
  full: "min-h-[calc(100svh-6rem)] md:min-h-[calc(100svh-5rem)]",
};
const AGENCY_HEIGHTS: Record<BannerData["height"], string> = {
  short: "min-h-[62svh]",
  tall: "min-h-[76svh]",
  full: "min-h-[calc(100svh-6rem)] md:min-h-[calc(100svh-5rem)]",
};
// Literal md: variants (Tailwind only generates classes it sees verbatim, so
// these can't be built from HEIGHTS at runtime). Used by the split layout.
const HEIGHTS_MD: Record<BannerData["height"], string> = {
  short: "md:h-[48vh]",
  tall: "md:h-[72vh]",
  full: "md:h-[88vh]",
};

const HEADLINE_SIZE: Record<BannerData["headlineSize"], string> = {
  sm: "text-2xl sm:text-3xl",
  md: "text-3xl sm:text-5xl",
  lg: "text-4xl sm:text-6xl",
  xl: "text-5xl sm:text-7xl",
};
const HEADLINE_FONT: Record<BannerData["headlineFont"], string> = {
  sans: "font-sans font-semibold",
  serif: "font-serif font-medium",
};
const TRACKING: Record<BannerData["headlineTracking"], string> = {
  normal: "tracking-tight",
  wide: "tracking-wide",
  widest: "tracking-[0.2em]",
};

// Button styling, tone-aware: "light" sits over a photo (white-based), "dark"
// sits on a solid split panel (theme foreground).
function buttonClass(style: BannerData["buttonStyle"], tone: "light" | "dark") {
  const base = "inline-flex items-center text-sm font-medium transition";
  if (tone === "light") {
    switch (style) {
      case "pill":
        return `${base} rounded-full bg-white px-6 py-2.5 text-black hover:bg-white/90`;
      case "outline":
        return `${base} rounded-md border border-white/80 px-5 py-2.5 text-white hover:bg-white/10`;
      case "link":
        return `${base} text-white underline underline-offset-4 hover:opacity-80`;
      default:
        return `${base} rounded-md bg-white px-5 py-2.5 text-black hover:bg-white/90`;
    }
  }
  switch (style) {
    case "pill":
      return `${base} rounded-full bg-[hsl(var(--foreground))] px-6 py-2.5 text-[hsl(var(--background))] hover:opacity-90`;
    case "outline":
      return `${base} rounded-md border border-[hsl(var(--border))] px-5 py-2.5 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]`;
    case "link":
      return `${base} text-[hsl(var(--foreground))] underline underline-offset-4 hover:opacity-70`;
    default:
      return `${base} rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-[hsl(var(--background))] hover:opacity-90`;
  }
}

// Headline + subhead + CTA, styled per the block's typography and tone. When the
// reveal effect is on, the wrapper carries `banner-reveal` so children stagger.
function TextContent({
  block,
  align,
  tone,
}: {
  block: BannerData;
  align: "left" | "right" | "center";
  tone: "light" | "dark";
}) {
  const alignClass =
    align === "center"
      ? "items-center text-center"
      : align === "right"
        ? "items-end text-right"
        : "items-start text-left";
  const headColor = tone === "light" ? "text-white" : "text-[hsl(var(--foreground))]";
  const subColor =
    tone === "light" ? "text-white/85" : "text-[hsl(var(--muted-foreground))]";
  return (
    <div
      className={cn(
        "flex max-w-3xl flex-col",
        alignClass,
        block.effect === "reveal" && "banner-reveal",
      )}
    >
      {block.headline && (
        <h1
          className={cn(
            headColor,
            HEADLINE_FONT[block.headlineFont],
            HEADLINE_SIZE[block.headlineSize],
            TRACKING[block.headlineTracking],
            block.headlineCase === "upper" && "uppercase",
          )}
        >
          {block.headline}
        </h1>
      )}
      {block.subhead && (
        <p className={cn("mt-3 max-w-xl text-base", subColor)}>{block.subhead}</p>
      )}
      {block.ctaLabel && block.ctaHref && (
        <div className="mt-6">
          <Link href={block.ctaHref} className={buttonClass(block.buttonStyle, tone)}>
            {block.ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}

// The photo layer: WebGL distortion mounts a canvas; ken-burns / reveal wrap a
// static image in a CSS-animated element; none is a plain static image.
function BannerImage({
  photo,
  block,
  className,
}: {
  photo: PhotoDTO;
  block: BannerData;
  className?: string;
}) {
  const fx2 = block.focalX ?? 50;
  const fy2 = block.focalY ?? 50;
  const zoom = block.zoom ?? 1;
  if (block.effect === "webgl-distortion") {
    return (
      <HeroMedia
        photo={photo}
        className={className}
        variant="distort"
        focalX={fx2 / 100}
        focalY={fy2 / 100}
        zoom={zoom}
      />
    );
  }
  if (block.effect === "css-glitch-1" || block.effect === "css-glitch-2") {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <CssGlitchImage
          photo={photo}
          mode="hero"
          variant={block.effect === "css-glitch-2" ? "hero-ethereal" : "hero-haunted"}
          objectPosition={`${fx2}% ${fy2}%`}
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }
  const fx =
    block.effect === "ken-burns"
      ? "banner-kenburns"
      : block.effect === "reveal"
        ? "banner-image-reveal"
        : "";
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* fx wrapper carries the effect animation; zoom is a transform on the
          image itself (scaled around the focal point) so they compose. */}
      <div className={cn("absolute inset-0", fx)}>
        <ResponsiveImage
          photo={photo}
          sizes="100vw"
          priority
          className="h-full w-full object-cover"
          objectPosition={`${fx2}% ${fy2}%`}
          style={
            zoom !== 1
              ? { transform: `scale(${zoom})`, transformOrigin: `${fx2}% ${fy2}%` }
              : undefined
          }
        />
      </div>
    </div>
  );
}

function PrismaHeadline({
  text,
  showAsterisk,
}: {
  text: string;
  showAsterisk: boolean;
}) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-[0.08em] gap-y-1">
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          className="banner-prisma-word inline-block"
          style={
            {
              "--prisma-delay": `${180 + index * 80}ms`,
            } as CSSProperties
          }
        >
          {word}
          {showAsterisk && index === words.length - 1 && (
            <sup className="ml-2 align-super text-[0.32em] leading-none">*</sup>
          )}
        </span>
      ))}
    </span>
  );
}

function PrismaHeroBanner({
  block,
  photo,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
}) {
  const headline = block.headline.trim() || "Prisma";
  const subhead = block.subhead.trim();
  const videoUrl = block.prismaVideoUrl.trim();
  const fx = block.focalX ?? 50;
  const fy = block.focalY ?? 50;
  const zoom = block.zoom ?? 1;
  const overlay = block.overlay ?? "auto";
  const showOverlay = overlay !== "none";

  return (
    <section
      className={cn(
        "banner-prisma relative box-border w-full overflow-hidden bg-[hsl(var(--background))] p-0 sm:p-3",
        PRISMA_HEIGHTS[block.height],
      )}
    >
      <div className="relative h-full min-h-[inherit] w-full overflow-hidden rounded-2xl bg-neutral-950 md:rounded-[2rem]">
        {photo && (
          <ResponsiveImage
            photo={photo}
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover"
            objectPosition={`${fx}% ${fy}%`}
            style={
              zoom !== 1
                ? { transform: `scale(${zoom})`, transformOrigin: `${fx}% ${fy}%` }
                : undefined
            }
          />
        )}
        {videoUrl && (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={videoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
        )}
        {showOverlay && (
          <>
            <div
              className={cn(
                "banner-prisma-noise pointer-events-none absolute inset-0 mix-blend-overlay",
                overlay === "dark" ? "opacity-85" : "opacity-70",
              )}
            />
            <div
              className={cn(
                "pointer-events-none absolute inset-0",
                overlay === "dark"
                  ? "bg-gradient-to-b from-black/50 via-black/10 to-black/80"
                  : "bg-gradient-to-b from-black/30 via-transparent to-black/65",
              )}
            />
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-5 sm:px-6 sm:pb-7 md:px-10 md:pb-9">
          <div className="flex max-w-5xl flex-col items-start">
            <h1 className="max-w-full font-sans text-6xl font-medium leading-[0.85] tracking-normal text-[#e1e0cc] sm:text-7xl md:text-[7.5rem] lg:text-[9rem] xl:text-[10.5rem] 2xl:text-[11.5rem]">
              <PrismaHeadline
                text={headline}
                showAsterisk={block.prismaShowAsterisk !== false}
              />
            </h1>
            {subhead && (
              <p className="banner-prisma-copy mt-4 max-w-md text-xs leading-[1.2] text-[#e1e0cc]/75 sm:text-sm md:mt-5 md:text-base">
                {subhead}
              </p>
            )}
            {block.ctaLabel && block.ctaHref && (
              <Link
                href={block.ctaHref}
                className="banner-prisma-cta group mt-5 inline-flex items-center gap-2 rounded-full bg-[#e1e0cc] py-1 pl-5 pr-1 text-sm font-medium leading-none text-black transition-all hover:gap-3 sm:text-base"
              >
                {block.ctaLabel}
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black">
                  <ArrowRight className="h-4 w-4 text-[#e1e0cc]" aria-hidden="true" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AgencyViralBanner({
  block,
  photo,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
}) {
  const headline = block.headline.trim() || "Agency that makes your";
  const accent = block.agencyAccentText.trim() || "videos & reels viral";
  const subhead = block.subhead.trim();
  const videoUrl = block.agencyVideoUrl.trim();
  const fx = block.focalX ?? 50;
  const fy = block.focalY ?? 50;
  const zoom = block.zoom ?? 1;
  const overlay = block.overlay ?? "auto";
  const showOverlay = overlay !== "none";

  return (
    <section
      className={cn(
        "banner-agency relative flex w-full items-center justify-center overflow-hidden bg-neutral-950 px-4 py-14 text-center",
        AGENCY_HEIGHTS[block.height],
      )}
    >
      {photo && (
        <ResponsiveImage
          photo={photo}
          sizes="100vw"
          priority
          className="absolute inset-0 h-full w-full object-cover"
          objectPosition={`${fx}% ${fy}%`}
          style={
            zoom !== 1
              ? { transform: `scale(${zoom})`, transformOrigin: `${fx}% ${fy}%` }
              : undefined
          }
        />
      )}
      {videoUrl && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )}
      {showOverlay && (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              overlay === "dark" ? "bg-black/55" : "bg-black/35",
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-0",
              overlay === "dark"
                ? "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.24)_42%,rgba(0,0,0,0.72)_100%)]"
                : "bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.16)_45%,rgba(0,0,0,0.56)_100%)]",
            )}
          />
        </>
      )}

      <div className="relative z-10 flex max-w-5xl flex-col items-center pt-8 sm:pt-10 md:pt-12">
        <h1
          className="banner-agency-heading text-white"
          style={{ textShadow: "0 10px 30px rgb(0 0 0 / 0.5)" }}
        >
          <span className="block font-sans text-3xl font-semibold leading-[1.1] tracking-normal sm:text-4xl md:text-5xl lg:text-6xl">
            {headline}
          </span>
          <span className="mt-1 block font-serif text-5xl italic leading-[1.05] tracking-normal sm:text-6xl md:text-7xl lg:text-8xl">
            {accent}
          </span>
        </h1>
        {subhead && (
          <p className="banner-agency-copy mt-6 max-w-xl text-sm font-medium leading-relaxed text-white/75 sm:text-base md:text-lg">
            {subhead}
          </p>
        )}
        {block.ctaLabel && block.ctaHref && (
          <Link
            href={block.ctaHref}
            className="banner-agency-cta mt-10 inline-flex items-center gap-3 rounded-full bg-white px-8 py-4 text-base font-medium leading-none text-black transition hover:bg-white/90"
          >
            <span className="flex h-5 w-5 items-center justify-center">
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            </span>
            {block.ctaLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

function Scrim({ block }: { block: BannerData }) {
  const hasText = Boolean(
    block.headline || block.subhead || (block.ctaLabel && block.ctaHref),
  );
  const mode = block.overlay ?? "auto";
  const show = mode === "dark" || (mode === "auto" && hasText);
  if (!show) return null;
  const cls =
    mode === "dark"
      ? "bg-gradient-to-t from-black/75 via-black/30 to-black/10"
      : "bg-gradient-to-t from-black/60 via-black/10 to-transparent";
  return <div className={`absolute inset-0 ${cls}`} />;
}

// Full-bleed photo with text overlaid (bottom-left / bottom-right / center).
function OverlayBanner({
  block,
  photo,
  h,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
  h: string;
}) {
  const pos = block.layout === "center" ? "items-center" : "items-end";
  const align =
    block.layout === "center" ? "center" : block.layout === "bottom-right" ? "right" : "left";
  const containerClass =
    block.layout === "center"
      ? "flex justify-center py-12"
      : block.layout === "bottom-right"
        ? "flex justify-end pb-12 md:pr-[14vw] lg:pr-[14vw]"
        : "flex justify-start pb-12 md:pl-[10vw] lg:pl-[10vw]";
  return (
    <section className={`relative ${h} w-full overflow-hidden bg-[hsl(var(--muted))]`}>
      {photo && <BannerImage photo={photo} block={block} className="absolute inset-0 h-full w-full" />}
      <Scrim block={block} />
      <div className={`absolute inset-0 flex ${pos}`}>
        <Container className={containerClass}>
          <TextContent block={block} align={align} tone="light" />
        </Container>
      </div>
    </section>
  );
}

// Image band height for the vertical (top/bottom) splits.
const SPLIT_VERT_IMG: Record<BannerData["height"], string> = {
  short: "h-[35vh]",
  tall: "h-[55vh]",
  full: "h-[70vh]",
};

// Image on one side/band, text panel on the other. split-left/right = side by
// side; split-top/bottom = stacked (image band + text panel).
function SplitBanner({
  block,
  photo,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
}) {
  if (block.layout === "split-top" || block.layout === "split-bottom") {
    const imageFirst = block.layout === "split-top";
    const imageBand = (
      <div className={`relative w-full overflow-hidden ${SPLIT_VERT_IMG[block.height]}`}>
        {photo ? (
          <BannerImage photo={photo} block={block} className="absolute inset-0 h-full w-full" />
        ) : (
          <div className="h-full w-full bg-[hsl(var(--muted))]" />
        )}
      </div>
    );
    const textBand = (
      <div className="flex items-center bg-[hsl(var(--background))] px-6 py-10 sm:px-10">
        <TextContent block={block} align="left" tone="dark" />
      </div>
    );
    return (
      <section className="relative w-full overflow-hidden">
        <div className="flex flex-col">
          {imageFirst ? (
            <>
              {imageBand}
              {textBand}
            </>
          ) : (
            <>
              {textBand}
              {imageBand}
            </>
          )}
        </div>
      </section>
    );
  }
  const imageFirst = block.layout === "split-left";
  const textAlign = imageFirst ? "left" : "right";
  const imageHalf = (
    <div className="relative h-56 w-full overflow-hidden md:h-full">
      {photo ? (
        <BannerImage photo={photo} block={block} className="absolute inset-0 h-full w-full" />
      ) : (
        <div className="h-full w-full bg-[hsl(var(--muted))]" />
      )}
    </div>
  );
  const textHalf = (
    <div
      className={cn(
        "flex items-center bg-[hsl(var(--background))] px-8 py-10 md:px-12",
        imageFirst ? "justify-start" : "justify-end",
      )}
    >
      <TextContent block={block} align={textAlign} tone="dark" />
    </div>
  );
  return (
    <section className={`relative w-full overflow-hidden ${HEIGHTS_MD[block.height]}`}>
      <div className="grid h-full grid-cols-1 md:grid-cols-2">
        {imageFirst ? (
          <>
            {imageHalf}
            {textHalf}
          </>
        ) : (
          <>
            {textHalf}
            {imageHalf}
          </>
        )}
      </div>
    </section>
  );
}

// Curated full-bleed / split banner with selectable layout, typography,
// button style, and graceful, reduced-motion-aware effects.
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

  if (block.layout === "prisma-hero") {
    return <PrismaHeroBanner block={block} photo={resolved} />;
  }
  if (block.layout === "agency-viral-hero") {
    return <AgencyViralBanner block={block} photo={resolved} />;
  }
  if (block.layout.startsWith("split-")) {
    return <SplitBanner block={block} photo={resolved} />;
  }
  return <OverlayBanner block={block} photo={resolved} h={h} />;
}
