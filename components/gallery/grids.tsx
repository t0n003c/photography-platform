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
  /** Horizontal-scroll only: detail-view text-overlay style. */
  overlay?: "minimal" | "editorial" | "centered";
  onOpen: (index: number) => void;
}

export type ToraPropsCaptionSource = "auto" | "headline" | "alt" | "caption";
export type ToraSliphoverLabelSource = ToraPropsCaptionSource;

export interface ToraPropsCatalogGridProps {
  photos: PhotoDTO[];
  onOpen: (index: number) => void;
  useBackground?: boolean;
  backgroundColor?: string;
  captionColor?: string;
  showCaptions?: boolean;
  captionSource?: ToraPropsCaptionSource;
}

export interface ToraSliphoverGridProps {
  photos: PhotoDTO[];
  onOpen: (index: number) => void;
  useBackground?: boolean;
  backgroundColor?: string;
  labelSource?: ToraSliphoverLabelSource;
  labelBackgroundColor?: string;
  labelTextColor?: string;
}

const TORA_PROPS_DEFAULT_BACKGROUND = "#252626";
const TORA_PROPS_DEFAULT_CAPTION = "#edd8aa";
const TORA_SLIPHOVER_DEFAULT_BACKGROUND = "#f3eadb";
const TORA_SLIPHOVER_LEGACY_DARK_BACKGROUND = "#242625";
const TORA_SLIPHOVER_DEFAULT_LABEL_BG = "#111111";
const TORA_SLIPHOVER_DEFAULT_LABEL_TEXT = "#f8f3df";

function ratio(photo: PhotoDTO): number {
  if (!photo.height) return 1;
  return photo.width / photo.height;
}

function tileLabel(photo: PhotoDTO): string {
  return `View ${photo.altText || "photo"}`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function propsCaption(
  photo: PhotoDTO,
  index: number,
  source: ToraPropsCaptionSource,
): string {
  if (source === "headline") return cleanText(photo.headline) ?? `Photo ${index + 1}`;
  if (source === "alt") return cleanText(photo.altText) ?? `Photo ${index + 1}`;
  if (source === "caption") return cleanText(photo.caption) ?? `Photo ${index + 1}`;
  return (
    cleanText(photo.headline) ??
    cleanText(photo.altText) ??
    cleanText(photo.caption) ??
    `Photo ${index + 1}`
  );
}

function photoHref(photo: PhotoDTO): string {
  return (
    photo.variants.find((variant) => variant.sizeBucket === "large")?.url ??
    photo.variants[0]?.url ??
    "#"
  );
}

function sliphoverLabel(
  photo: PhotoDTO,
  index: number,
  source: ToraSliphoverLabelSource,
): string {
  return propsCaption(photo, index, source);
}

function sliphoverColumnCount(width: number) {
  if (width <= 480) return 1;
  if (width <= 600) return 2;
  if (width <= 1024) return 3;
  return 5;
}

function distributeSliphoverColumns(photos: PhotoDTO[], columnCount: number) {
  const columns = Array.from({ length: columnCount }, () => ({
    height: 0,
    items: [] as { photo: PhotoDTO; index: number }[],
  }));
  photos.forEach((photo, index) => {
    const shortest = columns.reduce((best, column, columnIndex) =>
      column.height < columns[best].height ? columnIndex : best,
    0);
    columns[shortest].items.push({ photo, index });
    columns[shortest].height += 1 / Math.max(0.2, ratio(photo)) + 0.04;
  });
  return columns;
}

function isDefaultColor(value: string | undefined, defaultValue: string): boolean {
  return !value || value.trim().toLowerCase() === defaultValue;
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

/** ToraMochie Props reference: square catalog tiles with warm captions. */
export function ToraPropsCatalogGrid({
  photos,
  onOpen,
  useBackground = true,
  backgroundColor = TORA_PROPS_DEFAULT_BACKGROUND,
  captionColor = TORA_PROPS_DEFAULT_CAPTION,
  showCaptions = true,
  captionSource = "auto",
}: ToraPropsCatalogGridProps) {
  const hasCustomBackground = !isDefaultColor(backgroundColor, TORA_PROPS_DEFAULT_BACKGROUND);
  const hasCustomCaption = !isDefaultColor(captionColor, TORA_PROPS_DEFAULT_CAPTION);
  const style = {
    ...(hasCustomBackground ? { "--tora-props-bg": backgroundColor } : {}),
    ...(hasCustomCaption ? { "--tora-props-caption": captionColor } : {}),
  } as React.CSSProperties;

  return (
    <section
      className={cn(
        "tora-props-catalog",
        !useBackground && "tora-props-catalog--plain",
        hasCustomBackground && "tora-props-catalog--custom-bg",
      )}
      style={style}
    >
      <div className="tora-props-catalog__inner">
        <div className="tora-props-catalog__grid">
          {photos.map((photo, i) => {
            const caption = propsCaption(photo, i, captionSource);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`View ${caption}`}
                className="tora-props-catalog__item"
              >
                <span className="tora-props-catalog__image">
                  <ResponsiveImage
                    photo={photo}
                    sizes="(min-width:1120px) 206px, (min-width:768px) 30vw, 50vw"
                    className="h-full w-full"
                  />
                </span>
                {showCaptions && (
                  <span className="tora-props-catalog__caption">{caption}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** ToraMochie Gallery Sliphover reference: tight full-width masonry with a
 * cursor-following uppercase title badge on desktop hover. */
export function ToraSliphoverGrid({
  photos,
  onOpen,
  useBackground = true,
  backgroundColor = TORA_SLIPHOVER_DEFAULT_BACKGROUND,
  labelSource = "auto",
  labelBackgroundColor = TORA_SLIPHOVER_DEFAULT_LABEL_BG,
  labelTextColor = TORA_SLIPHOVER_DEFAULT_LABEL_TEXT,
}: ToraSliphoverGridProps) {
  const rootRef = React.useRef<HTMLElement>(null);
  const popupRef = React.useRef<HTMLSpanElement>(null);
  const hoverLabelRef = React.useRef("");
  const itemRefs = React.useRef(new Map<string, HTMLAnchorElement>());
  const previousRectsRef = React.useRef(new Map<string, DOMRect>());
  const pendingFlipRef = React.useRef(false);
  const didMeasureRef = React.useRef(false);
  const [mounted, setMounted] = React.useState(false);
  const [columnCount, setColumnCount] = React.useState(5);
  const [hoverLabel, setHoverLabel] = React.useState("");
  const columns = React.useMemo(
    () => distributeSliphoverColumns(photos, columnCount),
    [photos, columnCount],
  );
  const hasCustomBackground = !isDefaultColor(
    backgroundColor,
    TORA_SLIPHOVER_DEFAULT_BACKGROUND,
  ) && !isDefaultColor(backgroundColor, TORA_SLIPHOVER_LEGACY_DARK_BACKGROUND);
  const hasCustomLabelBackground = !isDefaultColor(
    labelBackgroundColor,
    TORA_SLIPHOVER_DEFAULT_LABEL_BG,
  );
  const hasCustomLabelText = !isDefaultColor(
    labelTextColor,
    TORA_SLIPHOVER_DEFAULT_LABEL_TEXT,
  );
  const style = {
    ...(hasCustomBackground ? { "--tora-sliphover-bg": backgroundColor } : {}),
    ...(hasCustomLabelBackground
      ? { "--tora-sliphover-label-bg": labelBackgroundColor }
      : {}),
    ...(hasCustomLabelText
      ? { "--tora-sliphover-label-text": labelTextColor }
      : {}),
  } as React.CSSProperties;

  const captureItemRects = React.useCallback(() => {
    const rects = new Map<string, DOMRect>();
    itemRefs.current.forEach((element, id) => {
      rects.set(id, element.getBoundingClientRect());
    });
    return rects;
  }, []);

  React.useEffect(() => {
    setMounted(true);
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const nextColumnCount = sliphoverColumnCount(
        root.clientWidth || window.innerWidth,
      );
      setColumnCount((currentColumnCount) => {
        if (currentColumnCount === nextColumnCount) return currentColumnCount;
        const prefersReducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (didMeasureRef.current && !prefersReducedMotion) {
          previousRectsRef.current = captureItemRects();
          pendingFlipRef.current = true;
          hoverLabelRef.current = "";
          setHoverLabel("");
        }
        return nextColumnCount;
      });
      didMeasureRef.current = true;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [captureItemRects]);

  React.useLayoutEffect(() => {
    if (!pendingFlipRef.current) return;
    pendingFlipRef.current = false;
    const previousRects = previousRectsRef.current;
    previousRectsRef.current = new Map();
    if (previousRects.size === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    itemRefs.current.forEach((element, id) => {
      const before = previousRects.get(id);
      if (!before) return;
      const after = element.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      const scaleX = before.width / Math.max(after.width, 1);
      const scaleY = before.height / Math.max(after.height, 1);
      const moved =
        Math.abs(dx) > 0.5 ||
        Math.abs(dy) > 0.5 ||
        Math.abs(scaleX - 1) > 0.01 ||
        Math.abs(scaleY - 1) > 0.01;
      if (!moved) return;

      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [
          {
            transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "top left",
          },
          {
            transform: "translate(0, 0) scale(1, 1)",
            transformOrigin: "top left",
          },
        ],
        {
          duration: 900,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
  }, [columns]);

  const showPopup = (
    event: React.PointerEvent<HTMLElement>,
    label: string,
  ) => {
    if (event.pointerType !== "mouse") return;
    const root = rootRef.current;
    const popup = popupRef.current;
    if (!root || !popup) return;
    const rect = root.getBoundingClientRect();
    popup.style.setProperty(
      "--tora-sliphover-x",
      `${event.clientX - rect.left + 15}px`,
    );
    popup.style.setProperty(
      "--tora-sliphover-y",
      `${event.clientY - rect.top}px`,
    );
    if (hoverLabelRef.current !== label) {
      hoverLabelRef.current = label;
      setHoverLabel(label);
    }
  };

  const hidePopup = () => {
    hoverLabelRef.current = "";
    setHoverLabel("");
  };

  const item = (photo: PhotoDTO, index: number) => {
    const label = sliphoverLabel(photo, index, labelSource);
    const href = photoHref(photo);
    return (
      <a
        key={photo.id}
        ref={(element) => {
          if (element) itemRefs.current.set(photo.id, element);
          else itemRefs.current.delete(photo.id);
        }}
        href={href}
        aria-label={`View ${label}`}
        className="tora-sliphover__item"
        onClick={(event) => {
          event.preventDefault();
          onOpen(index);
        }}
        onPointerMove={(event) => showPopup(event, label)}
        onPointerLeave={hidePopup}
      >
        <ResponsiveImage
          photo={photo}
          sizes="(min-width:1280px) 20vw, (min-width:768px) 33vw, (min-width:600px) 50vw, 100vw"
          className="tora-sliphover__image"
        />
      </a>
    );
  };

  return (
    <section
      ref={rootRef}
      className={cn(
        "tora-sliphover",
        !useBackground && "tora-sliphover--plain",
        hasCustomBackground && "tora-sliphover--custom-bg",
      )}
      style={style}
    >
      {!mounted ? (
        <div className="tora-sliphover__fallback">
          {photos.map((photo, index) => item(photo, index))}
        </div>
      ) : (
        <div className="tora-sliphover__inner">
          {columns.map((column, columnIndex) => (
            <div className="tora-sliphover__column" key={columnIndex}>
              {column.items.map(({ photo, index }) => item(photo, index))}
            </div>
          ))}
        </div>
      )}
      <span
        ref={popupRef}
        className={cn("tora-sliphover__popup", hoverLabel && "is-visible")}
        aria-hidden="true"
      >
        {hoverLabel}
      </span>
    </section>
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
export function HorizontalLenisGrid({ photos, overlay = "minimal" }: GridProps) {
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

  // While the detail is open, collapse the OTHER images (clip away) and expand
  // them back on close. The CLICKED image is NOT collapsed — it's hidden,
  // because it flies to/from the full view as a separate morphing copy in the
  // overlay. It's restored only once the overlay has fully closed (activeIndex
  // cleared), so the row thumbnail and the morph hand off seamlessly.
  React.useEffect(() => {
    const content = contentRef.current;
    if (!content || reduce) return;
    const items = content.querySelectorAll<HTMLElement>("[data-hl-item]");
    items.forEach((el, i) => {
      if (i === activeIndex) {
        el.style.transition = "none";
        el.style.clipPath = "inset(0% 0 0 0)";
        el.style.opacity = "0";
      } else {
        el.style.opacity = "";
        el.style.transition = "clip-path 0.7s cubic-bezier(0.76, 0, 0.24, 1)";
        el.style.clipPath = open ? "inset(100% 0 0 0)" : "inset(0% 0 0 0)";
      }
    });
  }, [open, activeIndex, reduce]);

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
          overlay={overlay}
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
  overlay = "minimal",
  onClose,
  onNav,
}: {
  photos: PhotoDTO[];
  index: number;
  startRect: DOMRect | null;
  open: boolean;
  overlay?: "minimal" | "editorial" | "centered";
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
    // "editorial" leaves side room for the flanking titles + side text.
    const widthFactor = overlay === "editorial" ? 0.54 : overlay === "centered" ? 0.82 : 0.92;
    const heightFactor = overlay === "editorial" ? 0.62 : 0.72;
    const maxH = window.innerHeight * heightFactor;
    const maxW = window.innerWidth * widthFactor;
    const ar = (photo.width || 1) / (photo.height || 1);
    let h = maxH;
    let w = h * ar;
    if (w > maxW) {
      w = maxW;
      h = w / ar;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [photo.width, photo.height, overlay]);

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

  // The morphing image — reused by whichever overlay layout renders.
  const imageEl = (
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
  );

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

      {overlay === "editorial" ? (
        // Reference look: the photo flanked by huge titles straddling its top
        // and bottom edges (mix-blend so they always contrast), with side text.
        <figure
          className="relative z-[1]"
          style={{ width: display.w, height: display.h }}
          onClick={(e) => e.stopPropagation()}
        >
          {imageEl}
          {title && (
            <div
              className={cn(
                "pointer-events-none absolute left-0 z-20 w-[120%] mix-blend-difference",
                chrome,
              )}
              style={{ bottom: "calc(100% - 2vw)" }}
            >
              <span className="block overflow-hidden">
                <span
                  className={`block whitespace-nowrap text-[clamp(2.25rem,7vw,8.5rem)] font-bold uppercase leading-[0.82] tracking-tight text-white ${reveal} delay-200 ${
                    shown ? "translate-y-0" : "translate-y-full"
                  }`}
                >
                  {title}
                </span>
              </span>
            </div>
          )}
          {subhead && (
            <div
              className={cn(
                "pointer-events-none absolute right-0 z-20 w-[120%] text-right mix-blend-difference",
                chrome,
              )}
              style={{ top: "calc(100% - 2.25vw)" }}
            >
              <span className="block overflow-hidden">
                <span
                  className={`block whitespace-nowrap text-[clamp(1.75rem,4.6vw,5.5rem)] font-bold uppercase leading-[0.85] tracking-tight text-white ${reveal} delay-300 ${
                    shown ? "translate-y-0" : "translate-y-full"
                  }`}
                >
                  {subhead}
                </span>
              </span>
            </div>
          )}
          {/* Left side: counter at the top, date running vertically up the
              bottom-left edge. */}
          <div
            className={cn(
              "absolute top-0 z-20 hidden h-full w-[15vw] pr-5 text-right text-white/70 md:block",
              chrome,
            )}
            style={{ right: "100%" }}
          >
            <span
              className={`block pt-[2vw] font-mono text-xs tracking-widest ${reveal} delay-200 ${
                shown ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"
              }`}
            >
              {counter}
            </span>
            {date && (
              <span
                className={`absolute bottom-[8%] right-2 rotate-180 whitespace-nowrap text-[0.7rem] uppercase tracking-[0.3em] text-white/55 [writing-mode:vertical-rl] ${reveal} delay-300 ${
                  shown ? "opacity-100" : "opacity-0"
                }`}
              >
                {date}
              </span>
            )}
          </div>
          {/* Right side: caption at the top. */}
          {caption && (
            <div
              className={cn(
                "absolute top-0 z-20 hidden h-full w-[15vw] pl-5 text-white/75 md:block",
                chrome,
              )}
              style={{ left: "100%" }}
            >
              <p
                className={`pt-[2vw] text-sm leading-relaxed ${reveal} delay-200 ${
                  shown ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"
                }`}
              >
                {caption}
              </p>
            </div>
          )}
        </figure>
      ) : overlay === "centered" ? (
        // Title centered over the photo on a soft scrim; caption below.
        <figure
          className="relative z-[1] flex flex-col items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative" style={{ width: display.w, height: display.h }}>
            {imageEl}
            <div className="pointer-events-none absolute inset-0 z-10 rounded-sm bg-gradient-to-t from-black/55 via-black/25 to-black/40" />
            <div
              className={cn(
                "pointer-events-none absolute left-4 top-4 z-20 font-mono text-xs tracking-widest text-white/85",
                chrome,
              )}
            >
              {counter}
            </div>
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 p-6 text-center text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.55)]",
                chrome,
              )}
            >
              {title && (
                <span className="block overflow-hidden">
                  <span
                    className={`block text-3xl font-semibold leading-tight tracking-tight sm:text-5xl ${reveal} delay-200 ${
                      shown ? "translate-y-0" : "translate-y-full"
                    }`}
                  >
                    {title}
                  </span>
                </span>
              )}
              {subhead && (
                <span
                  className={`text-sm uppercase tracking-[0.2em] text-white/85 ${reveal} delay-300 ${
                    shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  }`}
                >
                  {subhead}
                </span>
              )}
            </div>
          </div>
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
      ) : (
        // Minimal (default): counter/date top, title + subhead bottom-left over
        // a scrim, caption below.
        <figure
          className="relative z-[1] flex max-h-full flex-col items-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative" style={{ width: display.w, height: display.h }}>
            {imageEl}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 z-10 flex flex-col justify-between rounded-sm p-4 sm:p-6",
                chrome,
              )}
            >
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
