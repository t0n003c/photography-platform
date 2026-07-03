"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type FeatureCarouselBlockData = Extract<LeafBlock, { type: "featureCarousel" }>;
type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

interface FeatureCarouselBlockProps {
  block: FeatureCarouselBlockData;
  photoMap: Map<string, PhotoDTO>;
}

const RADIUS: Record<FeatureCarouselBlockData["imageRadius"], string> = {
  lg: "rounded-[1.35rem]",
  xl: "rounded-[1.9rem]",
  full: "rounded-[2.75rem]",
};
const VISIBLE_COUNTS = new Set(["3", "5", "7"]);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function selectedPhotos(block: FeatureCarouselBlockData, photoMap: Map<string, PhotoDTO>) {
  return block.photoIds
    .map((id) => photoMap.get(id))
    .filter((photo): photo is PhotoDTO => Boolean(photo));
}

function modulo(value: number, size: number) {
  return ((value % size) + size) % size;
}

function signedDistance(index: number, active: number, count: number) {
  const raw = modulo(index - active, count);
  return raw > count / 2 ? raw - count : raw;
}

function renderHeadline({
  headline,
  highlightText,
  highlightFrom,
  highlightTo,
}: {
  headline: string;
  highlightText: string;
  highlightFrom: string;
  highlightTo: string;
}) {
  const cleanHeadline = headline.trim() || "Edit Your Photos on the Go";
  const cleanHighlight = highlightText.trim();
  if (!cleanHighlight) return cleanHeadline;

  const lower = cleanHeadline.toLowerCase();
  const needle = cleanHighlight.toLowerCase();
  const index = lower.indexOf(needle);
  const highlightStyle = {
    backgroundImage: `linear-gradient(90deg, ${highlightFrom}, ${highlightTo})`,
  };

  if (index < 0) {
    return (
      <>
        {cleanHeadline}{" "}
        <span
          className="bg-clip-text text-transparent"
          style={highlightStyle}
        >
          {cleanHighlight}
        </span>
      </>
    );
  }

  return (
    <>
      {cleanHeadline.slice(0, index)}
      <span className="bg-clip-text text-transparent" style={highlightStyle}>
        {cleanHeadline.slice(index, index + cleanHighlight.length)}
      </span>
      {cleanHeadline.slice(index + cleanHighlight.length)}
    </>
  );
}

function normalizeVisibleCount(value: string | undefined) {
  return VISIBLE_COUNTS.has(value ?? "") ? Number(value) : 3;
}

function cardVars(
  distance: number,
  visibleCount: number,
  prefix: "mobile" | "desktop",
): CSSPropertiesWithVars {
  const abs = Math.abs(distance);
  const sideSlots = Math.floor(visibleCount / 2);
  const isVisible = abs <= sideSlots;
  const clampedDistance = Math.max(-sideSlots, Math.min(sideSlots, distance));
  const spread = visibleCount === 7 ? 48 : visibleCount === 5 ? 52 : 48;
  const x = clampedDistance * spread;
  const rotate = clampedDistance * (visibleCount === 7 ? 8 : 10);
  const scale = abs === 0 ? 1 : Math.max(0.64, 0.9 - abs * 0.1);
  const opacity =
    abs === 0
      ? 1
      : isVisible
        ? Math.max(0.16, 0.62 - abs * 0.16)
        : 0;
  const blur = abs === 0 ? 0 : Math.min(7, 2.5 + abs * 1.25);

  return {
    [`--feature-carousel-x-${prefix}`]: `${x}%`,
    [`--feature-carousel-scale-${prefix}`]: scale,
    [`--feature-carousel-rotate-${prefix}`]: `${rotate}deg`,
    [`--feature-carousel-opacity-${prefix}`]: opacity,
    [`--feature-carousel-blur-${prefix}`]: `${blur}px`,
    [`--feature-carousel-z-${prefix}`]: 30 - abs,
    [`--feature-carousel-pointer-${prefix}`]: isVisible ? "auto" : "none",
  };
}

function cardStyle(
  distance: number,
  reduced: boolean,
  desktopVisibleCount: number,
): CSSPropertiesWithVars {
  if (reduced) {
    return {
      "--feature-carousel-x-mobile": "0%",
      "--feature-carousel-scale-mobile": 1,
      "--feature-carousel-rotate-mobile": "0deg",
      "--feature-carousel-opacity-mobile": distance === 0 ? 1 : 0,
      "--feature-carousel-blur-mobile": "0px",
      "--feature-carousel-z-mobile": distance === 0 ? 20 : 0,
      "--feature-carousel-pointer-mobile": distance === 0 ? "auto" : "none",
      "--feature-carousel-x-desktop": "0%",
      "--feature-carousel-scale-desktop": 1,
      "--feature-carousel-rotate-desktop": "0deg",
      "--feature-carousel-opacity-desktop": distance === 0 ? 1 : 0,
      "--feature-carousel-blur-desktop": "0px",
      "--feature-carousel-z-desktop": distance === 0 ? 20 : 0,
      "--feature-carousel-pointer-desktop": distance === 0 ? "auto" : "none",
    };
  }

  return {
    ...cardVars(distance, 3, "mobile"),
    ...cardVars(distance, desktopVisibleCount, "desktop"),
  };
}

export function FeatureCarouselBlock({
  block,
  photoMap,
}: FeatureCarouselBlockProps) {
  const photos = useMemo(() => selectedPhotos(block, photoMap), [block, photoMap]);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<number | null>(null);
  const hasMultiple = photos.length > 1;
  const showArrows = block.showArrows !== false && hasMultiple;
  const radiusClass = RADIUS[block.imageRadius ?? "xl"];
  const desktopVisibleCount = normalizeVisibleCount(block.desktopVisibleCount);
  const subtitle = block.subtitle.trim();
  const primaryLabel = block.primaryLabel.trim();
  const primaryHref = block.primaryHref.trim();
  const secondaryLabel = block.secondaryLabel.trim();
  const secondaryHref = block.secondaryHref.trim();
  const hasCtas = (primaryLabel && primaryHref) || (secondaryLabel && secondaryHref);

  useEffect(() => {
    if (active <= photos.length - 1) return;
    setActive(0);
  }, [active, photos.length]);

  const next = useCallback(() => {
    if (!hasMultiple) return;
    setActive((current) => modulo(current + 1, photos.length));
  }, [hasMultiple, photos.length]);

  const previous = useCallback(() => {
    if (!hasMultiple) return;
    setActive((current) => modulo(current - 1, photos.length));
  }, [hasMultiple, photos.length]);

  useEffect(() => {
    if (!block.autoplay || reduced || paused || !hasMultiple) return;
    const delay = Math.max(1200, Math.min(12000, block.autoplayMs ?? 4500));
    const timer = window.setInterval(next, delay);
    return () => window.clearInterval(timer);
  }, [block.autoplay, block.autoplayMs, hasMultiple, next, paused, reduced]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX;
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return;
    const delta = event.clientX - pointerStart.current;
    pointerStart.current = null;
    if (Math.abs(delta) < 36) return;
    if (delta < 0) next();
    else previous();
  };

  if (photos.length === 0) {
    return (
      <Container className="py-14 sm:py-20">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
          Feature carousel - add photos
        </div>
      </Container>
    );
  }

  return (
    <section
      className="feature-carousel-block relative overflow-hidden bg-[hsl(var(--background))] py-16 text-[hsl(var(--foreground))] sm:py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,0.10),transparent_34%),radial-gradient(circle_at_55%_36%,rgba(168,85,247,0.10),transparent_30%)] dark:bg-[radial-gradient(circle_at_50%_42%,rgba(59,130,246,0.14),transparent_34%),radial-gradient(circle_at_55%_36%,rgba(168,85,247,0.12),transparent_30%)]"
        aria-hidden="true"
      />
      <Container className="relative z-10">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mx-auto max-w-4xl text-balance text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
            {renderHeadline({
              headline: block.headline,
              highlightText: block.highlightText,
              highlightFrom: block.highlightFrom || "#3b82f6",
              highlightTo: block.highlightTo || "#a855f7",
            })}
          </h2>
          {subtitle && (
            <p className="mx-auto mt-6 max-w-2xl text-balance text-xl leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-2xl">
              {subtitle}
            </p>
          )}
          {hasCtas && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {primaryLabel && primaryHref && (
                <Link
                  href={primaryHref}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[hsl(var(--foreground))] px-5 text-sm font-semibold text-[hsl(var(--background))] transition hover:opacity-85"
                >
                  {primaryLabel}
                </Link>
              )}
              {secondaryLabel && secondaryHref && (
                <Link
                  href={secondaryHref}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-[hsl(var(--border))] px-5 text-sm font-semibold transition hover:bg-[hsl(var(--muted))]"
                >
                  {secondaryLabel}
                </Link>
              )}
            </div>
          )}
        </div>
      </Container>

      <div
        className="feature-carousel-stage relative mx-auto mt-10 h-[30rem] w-full max-w-6xl touch-pan-y select-none [perspective:1000px] sm:mt-14 sm:h-[34rem]"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {photos.map((photo, index) => {
            const distance = signedDistance(index, active, photos.length);
            return (
              <button
                key={photo.id}
                type="button"
                aria-label={`Show ${photo.altText || `photo ${index + 1}`}`}
                aria-current={distance === 0 ? "true" : undefined}
                disabled={reduced && distance !== 0}
                onClick={() => {
                  if (distance !== 0) setActive(index);
                }}
                className={cn(
                  "feature-carousel-card absolute left-1/2 top-1/2 h-[24rem] w-48 overflow-hidden border bg-[hsl(var(--muted))] shadow-2xl shadow-black/20 outline-none transition-[transform,opacity,filter,box-shadow] duration-500 ease-out will-change-transform focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] sm:h-[28rem] sm:w-64",
                  radiusClass,
                  distance === 0
                    ? "border-white/55 dark:border-white/20"
                    : "border-white/30 dark:border-white/10",
                )}
                style={cardStyle(distance, reduced, desktopVisibleCount)}
              >
                <ResponsiveImage
                  photo={photo}
                  sizes="(max-width: 767px) 50vw, 256px"
                  priority={index === active}
                  className="h-full w-full"
                />
              </button>
            );
          })}
        </div>

        {showArrows && (
          <>
            <button
              type="button"
              aria-label="Previous feature"
              onClick={previous}
              className="absolute left-4 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-[hsl(var(--background))] sm:left-8 sm:h-10 sm:w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next feature"
              onClick={next}
              className="absolute right-4 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 shadow-sm backdrop-blur transition hover:scale-105 hover:bg-[hsl(var(--background))] sm:right-8 sm:h-10 sm:w-10"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
