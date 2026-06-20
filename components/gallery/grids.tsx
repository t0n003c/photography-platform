"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

/**
 * Horizontal smooth-scroll gallery driven by Lenis: a single row of tall images
 * with an alternating vertical offset (odd up / even down), scrolled
 * horizontally by the wheel. Clicking opens the lightbox. Falls back to native
 * horizontal scroll under prefers-reduced-motion (no Lenis). Inspired by the
 * Moussa Mamadou "flip horizontal scroll" reference.
 */
export function HorizontalLenisGrid({ photos }: GridProps) {
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lenisRef = React.useRef<any>(null);
  // activeIndex stays set through the close animation; `open` flips first so the
  // close transition (reverse morph + the row expanding back) can play.
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);
  const [open, setOpen] = React.useState(false);
  // The clicked thumbnail's on-screen rect, so the detail view can morph open
  // from it (FLIP) rather than just popping in.
  const [startRect, setStartRect] = React.useState<DOMRect | null>(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return; // native horizontal scroll fallback

    let raf = 0;
    let cancelled = false;
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const lenis = new Lenis({
        wrapper,
        content,
        orientation: "horizontal",
        lerp: 0.06,
        smoothWheel: true,
        wheelMultiplier: 0.9,
      });
      lenisRef.current = lenis;
      const loop = (t: number) => {
        lenis.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Freeze the horizontal scroll while the detail overlay is open (or closing).
  React.useEffect(() => {
    const l = lenisRef.current;
    if (!l) return;
    if (activeIndex !== null) l.stop();
    else l.start();
  }, [activeIndex]);

  // Collapse the row's images (clip away) while the detail is open, and expand
  // them back on close — mirroring the reference's open/close transition.
  React.useEffect(() => {
    const content = contentRef.current;
    if (!content || reduce) return;
    const items = content.querySelectorAll<HTMLElement>("[data-hl-item]");
    items.forEach((el) => {
      el.style.transition = "clip-path 0.7s cubic-bezier(0.76, 0, 0.24, 1)";
      el.style.clipPath = open ? "inset(100% 0 0 0)" : "inset(0% 0 0 0)";
    });
  }, [open, reduce]);

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ height: "72vh" }}
      >
        <div
          ref={contentRef}
          className="flex h-full w-max items-center gap-[7vw] px-[12vw]"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              data-hl-item
              onClick={(e) => {
                setStartRect(e.currentTarget.getBoundingClientRect());
                setActiveIndex(i);
                setOpen(true);
              }}
              aria-label={tileLabel(photo)}
              style={{ transform: i % 2 === 0 ? "translateY(-13%)" : "translateY(13%)" }}
              className="block aspect-[3/4] h-[48vh] shrink-0 cursor-pointer overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
            >
              <ResponsiveImage
                photo={photo}
                sizes="(min-width:768px) 36vw, 70vw"
                className="h-full w-full object-cover transition-opacity hover:opacity-90"
              />
            </button>
          ))}
        </div>
      </div>
      {activeIndex !== null && (
        <HorizontalLenisDetail
          photos={photos}
          index={activeIndex}
          startRect={startRect}
          open={open}
          onClose={() => {
            setOpen(false);
            window.setTimeout(() => setActiveIndex(null), reduce ? 0 : 950);
          }}
          onNav={(dir) =>
            setActiveIndex((cur) =>
              cur === null ? cur : (cur + dir + photos.length) % photos.length,
            )
          }
        />
      )}
    </>
  );
}

// Click-to-expand detail view for the horizontal-lenis layout. The clicked
// thumbnail MORPHS into the centered photo (FLIP) over a fading backdrop, then
// its alt text / capture date animate in — in the spirit of the Moussa Mamadou
// reference, adapted to the metadata we store.
function HorizontalLenisDetail({
  photos,
  index,
  startRect,
  open,
  onClose,
  onNav,
}: {
  photos: PhotoDTO[];
  index: number;
  startRect: DOMRect | null;
  open: boolean;
  onClose: () => void;
  onNav: (dir: -1 | 1) => void;
}) {
  const photo = photos[index];
  const [shown, setShown] = React.useState(false);
  const [bgIn, setBgIn] = React.useState(false);
  const imgWrapRef = React.useRef<HTMLDivElement>(null);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Compute the displayed size ourselves (image aspect within 72vh × 92vw) so
  // the wrapper always has a definite, measurable size — its intrinsic size
  // would otherwise be 0 until the image lays out, breaking the FLIP measure.
  // (This overlay only ever renders client-side, so `window` is safe here.)
  const display = React.useMemo(() => {
    if (typeof window === "undefined") return { w: 0, h: 0 };
    const maxH = window.innerHeight * 0.72;
    const maxW = window.innerWidth * 0.92;
    const ar = (photo.width || 1) / (photo.height || 1);
    let h = maxH;
    let w = h * ar;
    if (w > maxW) {
      w = maxW;
      h = w / ar;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [photo.width, photo.height]);

  // Fade the backdrop + chrome with `open` (in on open, out on close).
  React.useEffect(() => {
    if (open) {
      const r = requestAnimationFrame(() => setBgIn(true));
      return () => cancelAnimationFrame(r);
    }
    setBgIn(false);
  }, [open]);

  // FLIP open: start the photo at the clicked thumbnail's rect, then animate
  // (slowly) to its natural centered position. The image is hidden until the
  // start transform is applied (pre-paint) so it never flashes at the final
  // spot, and the rect is measured a frame later so layout is settled.
  React.useLayoutEffect(() => {
    const el = imgWrapRef.current;
    if (!el || !startRect || reduce) return;
    el.style.opacity = "0";
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      const end = el.getBoundingClientRect();
      if (!end.width || !end.height) {
        el.style.opacity = "";
        return;
      }
      const dx = startRect.left - end.left;
      const dy = startRect.top - end.top;
      const sx = startRect.width / end.width;
      const sy = startRect.height / end.height;
      el.style.transformOrigin = "top left";
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      el.style.opacity = "1";
      void el.getBoundingClientRect(); // force reflow
      raf2 = requestAnimationFrame(() => {
        if (!imgWrapRef.current) return;
        imgWrapRef.current.style.transition =
          "transform 1.1s cubic-bezier(0.16, 1, 0.3, 1)";
        imgWrapRef.current.style.transform = "translate(0px, 0px) scale(1, 1)";
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FLIP close: reverse the morph back toward the thumbnail when `open` flips
  // false (the grid keeps us mounted for the duration, then unmounts).
  React.useEffect(() => {
    if (open) return;
    const el = imgWrapRef.current;
    if (!el || !startRect || reduce) return;
    const end = el.getBoundingClientRect();
    if (!end.width || !end.height) return;
    const dx = startRect.left - end.left;
    const dy = startRect.top - end.top;
    const sx = startRect.width / end.width;
    const sy = startRect.height / end.height;
    el.style.transformOrigin = "top left";
    el.style.transition =
      "transform 0.85s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.6s ease";
    el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
    el.style.opacity = "0.6";
  }, [open, startRect, reduce]);

  // (Re)play the text reveal whenever the shown photo changes.
  React.useEffect(() => {
    setShown(false);
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    );
    return () => cancelAnimationFrame(r);
  }, [index]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNav(1);
      else if (e.key === "ArrowLeft") onNav(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNav]);

  const date = photo.capturedAt
    ? new Date(photo.capturedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;
  // Editorial copy (set per photo in the Library); falls back to alt text.
  const title = photo.headline || photo.altText || "";
  const subhead = photo.subhead || "";
  const caption = photo.caption || "";
  const reveal = "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]";
  const chrome = cn("transition-opacity duration-500", bgIn ? "opacity-100" : "opacity-0");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-10"
      role="dialog"
      aria-modal="true"
      aria-label={photo.altText || "Photo"}
      onClick={onClose}
    >
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 bg-black/90 backdrop-blur-sm",
          "transition-opacity duration-500",
          bgIn ? "opacity-100" : "opacity-0",
        )}
      />
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          "absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20",
          chrome,
        )}
      >
        <X className="h-5 w-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={(e) => { e.stopPropagation(); onNav(-1); }}
            className={cn("absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20", chrome)}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={(e) => { e.stopPropagation(); onNav(1); }}
            className={cn("absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20", chrome)}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <figure
        className="relative z-[1] flex max-h-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image with overlaid text zones (counter/date top, title/subhead
            bottom over a scrim). The text overlay is a sibling of the morphing
            image, so it doesn't scale during the FLIP. */}
        <div className="relative" style={{ width: display.w, height: display.h }}>
          <div
            ref={imgWrapRef}
            className="absolute inset-0 overflow-hidden rounded-sm shadow-2xl will-change-transform"
          >
            <ResponsiveImage
              photo={photo}
              sizes="(min-width:768px) 70vw, 100vw"
              className="h-full w-full object-cover"
            />
          </div>

          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between rounded-sm p-4 sm:p-6",
              chrome,
            )}
          >
            {/* gradient scrim for the bottom text */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 rounded-b-sm bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            <div className="relative flex items-start justify-between gap-4 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)]">
              <span
                className={`font-mono text-xs tracking-widest text-white/85 ${reveal} delay-100 ${
                  shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                }`}
              >
                {counter}
              </span>
              {date && (
                <span
                  className={`text-xs uppercase tracking-wide text-white/85 ${reveal} delay-150 ${
                    shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                  }`}
                >
                  {date}
                </span>
              )}
            </div>

            <div className="relative text-white">
              {title && (
                <span className="block overflow-hidden">
                  <span
                    className={`block text-2xl font-semibold leading-tight tracking-tight sm:text-3xl ${reveal} delay-200 ${
                      shown ? "translate-y-0" : "translate-y-full"
                    }`}
                  >
                    {title}
                  </span>
                </span>
              )}
              {subhead && (
                <span
                  className={`mt-1 block text-sm uppercase tracking-wide text-white/80 ${reveal} delay-300 ${
                    shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  }`}
                >
                  {subhead}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Caption paragraph below the image. */}
        {caption && (
          <p
            className={cn(
              `max-w-2xl px-1 text-center text-sm leading-relaxed text-white/70 ${reveal} delay-300 ${
                shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
              }`,
              chrome,
            )}
            style={{ maxWidth: display.w || undefined }}
          >
            {caption}
          </p>
        )}
      </figure>
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
