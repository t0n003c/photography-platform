"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";
import { ResponsiveImage } from "./responsive-image";

export interface GridProps {
  photos: PhotoDTO[];
  /** Tailwind gap class(es), e.g. "gap-2 md:gap-3". */
  spacingClass: string;
  /** Masonry only: per-item margin-bottom to match the horizontal column-gap. */
  itemSpacingClass?: string;
  /** Carousel only: auto-advance through slides (pauses on hover). */
  autoplay?: boolean;
  onOpen: (index: number) => void;
}

function ratio(photo: PhotoDTO): number {
  if (!photo.height) return 1;
  return photo.width / photo.height;
}

function tileLabel(photo: PhotoDTO): string {
  return `View ${photo.altText || "photo"}`;
}

/** Masonry via CSS columns; items avoid breaking across columns. */
export function MasonryGrid({ photos, spacingClass, itemSpacingClass = "mb-2 md:mb-3", onOpen }: GridProps) {
  return (
    <div className={cn("columns-2 md:columns-3 xl:columns-4", spacingClass)}>
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={tileLabel(photo)}
          className={cn(
            "block w-full break-inside-avoid overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            itemSpacingClass,
          )}
        >
          <ResponsiveImage
            photo={photo}
            sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"
            className="transition-opacity hover:opacity-90"
          />
        </button>
      ))}
    </div>
  );
}

/** Uniform grid of square-cropped tiles. */
export function UniformGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        spacingClass,
      )}
    >
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={tileLabel(photo)}
          className="block aspect-square w-full overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ResponsiveImage
            photo={photo}
            sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
            className="h-full w-full transition-opacity hover:opacity-90"
          />
        </button>
      ))}
    </div>
  );
}

/** Horizontal sliding carousel with snap + prev/next arrows + optional auto-roll. */
export function CarouselGrid({ photos, spacingClass, autoplay, onOpen }: GridProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [paused, setPaused] = React.useState(false);
  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  // Auto-roll: step forward every few seconds, loop to the start at the end.
  // Pauses on hover/focus, and never runs under prefers-reduced-motion.
  React.useEffect(() => {
    if (!autoplay || paused || photos.length < 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const id = window.setInterval(() => {
      const el = ref.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      if (atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: el.clientWidth * 0.85, behavior: "smooth" });
    }, 3500);
    return () => window.clearInterval(id);
  }, [autoplay, paused, photos.length]);

  return (
    <div
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div
        ref={ref}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          spacingClass,
        )}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={tileLabel(photo)}
            className="block aspect-[3/2] w-[85%] shrink-0 snap-center overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:w-[60%] lg:w-[46%]"
          >
            <ResponsiveImage
              photo={photo}
              sizes="(min-width:1024px) 46vw, (min-width:640px) 60vw, 85vw"
              className="h-full w-full transition-opacity hover:opacity-90"
            />
          </button>
        ))}
      </div>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/65"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/65"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

// Perforation row: evenly spaced light "sprocket holes" on the dark film body.
const FILM_PERF_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(to right, transparent 0 7px, rgba(255,255,255,0.9) 7px 15px, transparent 15px 22px)",
  backgroundSize: "22px 100%",
};

/**
 * Single-row filmstrip styled as an actual strip of film: a dark celluloid body
 * with sprocket-hole perforations along the top and bottom edges. Scrolls
 * horizontally; each frame keeps its natural aspect ratio.
 */
export function FilmstripGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div className="overflow-x-auto rounded-md [scrollbar-width:thin]">
      <div className="inline-flex min-w-full flex-col gap-2 bg-[#171717] px-3 py-2.5">
        <div aria-hidden className="h-3 w-full rounded-[1px]" style={FILM_PERF_STYLE} />
        <div className={cn("flex", spacingClass)}>
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpen(i)}
              aria-label={tileLabel(photo)}
              style={{ aspectRatio: String(ratio(photo)) }}
              className="block h-44 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] md:h-60"
            >
              <ResponsiveImage
                photo={photo}
                sizes="40vw"
                className="h-full w-full transition-opacity hover:opacity-90"
              />
            </button>
          ))}
        </div>
        <div aria-hidden className="h-3 w-full rounded-[1px]" style={FILM_PERF_STYLE} />
      </div>
    </div>
  );
}

/** Mosaic: every Nth tile spans 2×2 for a curated, magazine feel. */
export function MosaicGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div
      className={cn(
        "grid grid-flow-dense grid-cols-2 auto-rows-[44vw] sm:auto-rows-[30vw] md:grid-cols-4 md:auto-rows-[15vw]",
        spacingClass,
      )}
    >
      {photos.map((photo, i) => {
        const big = i % 5 === 0;
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={tileLabel(photo)}
            className={cn(
              "block overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
              big && "col-span-2 row-span-2",
            )}
          >
            <ResponsiveImage
              photo={photo}
              sizes={big ? "(min-width:768px) 50vw, 100vw" : "(min-width:768px) 25vw, 50vw"}
              className="h-full w-full transition-opacity hover:opacity-90"
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Justified rows: flexbox where each item grows proportionally to its aspect
 * ratio so rows fill the available width at a roughly uniform height.
 */
export function JustifiedGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div className={cn("flex flex-wrap", spacingClass)}>
      {photos.map((photo, i) => {
        const ar = ratio(photo);
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={tileLabel(photo)}
            style={{ flexGrow: ar, flexBasis: ar * 260 }}
            className="block h-[260px] overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ResponsiveImage
              photo={photo}
              sizes="(min-width:768px) 33vw, 50vw"
              className="h-full w-full transition-opacity hover:opacity-90"
            />
          </button>
        );
      })}
    </div>
  );
}
