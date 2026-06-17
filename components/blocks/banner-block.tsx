import Link from "next/link";
import { Container } from "@/components/ui/container";
import { HeroMedia } from "@/components/webgl/hero-media";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
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
  if (block.effect === "webgl-distortion") {
    return <HeroMedia photo={photo} className={className} variant="distort" />;
  }
  const fx =
    block.effect === "ken-burns"
      ? "banner-kenburns"
      : block.effect === "reveal"
        ? "banner-image-reveal"
        : "";
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className={cn("absolute inset-0", fx)}>
        <ResponsiveImage
          photo={photo}
          sizes="100vw"
          priority
          className="h-full w-full object-cover"
          objectPosition={`${block.focalX ?? 50}% ${block.focalY ?? 50}%`}
        />
      </div>
    </div>
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
  const pos =
    block.layout === "center"
      ? "items-center justify-center"
      : block.layout === "bottom-right"
        ? "items-end justify-end"
        : "items-end justify-start";
  const align =
    block.layout === "center" ? "center" : block.layout === "bottom-right" ? "right" : "left";
  const pad = block.layout === "center" ? "py-12" : "pb-12";
  return (
    <section className={`relative ${h} w-full overflow-hidden bg-[hsl(var(--muted))]`}>
      {photo && <BannerImage photo={photo} block={block} className="absolute inset-0 h-full w-full" />}
      <Scrim block={block} />
      <div className={`absolute inset-0 flex ${pos}`}>
        <Container className={pad}>
          <TextContent block={block} align={align} tone="light" />
        </Container>
      </div>
    </section>
  );
}

// Image on one half, text panel on the other (split-left = image left).
function SplitBanner({
  block,
  photo,
}: {
  block: BannerData;
  photo: PhotoDTO | undefined;
}) {
  const imageFirst = block.layout === "split-left";
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
    <div className="flex items-center bg-[hsl(var(--background))] px-8 py-10 md:px-12">
      <TextContent block={block} align="left" tone="dark" />
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

  if (block.layout === "split-left" || block.layout === "split-right") {
    return <SplitBanner block={block} photo={resolved} />;
  }
  return <OverlayBanner block={block} photo={resolved} h={h} />;
}
