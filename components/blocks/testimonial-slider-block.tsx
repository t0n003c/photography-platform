"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type TestimonialsBlockData = Extract<LeafBlock, { type: "testimonials" }>;
type TestimonialItem = TestimonialsBlockData["items"][number];
type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

interface TestimonialSliderBlockProps {
  block: TestimonialsBlockData;
  photoMap: Map<string, PhotoDTO>;
}

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "R") + (parts[1]?.[0] ?? "");
}

function cleanQuote(quote: string) {
  return quote.trim().replace(/^["']+|["']+$/g, "");
}

function withTerminalDot(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function PlaceholderPortrait({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,hsl(var(--muted)),hsl(var(--foreground)))] text-3xl font-semibold text-[hsl(var(--background))]",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function Portrait({
  item,
  photo,
  className,
  priority,
  sizes = "(max-width: 767px) 78vw, 360px",
}: {
  item: TestimonialItem;
  photo?: PhotoDTO;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg bg-[hsl(var(--muted))]", className)}>
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes={sizes}
          priority={priority}
          className="h-full w-full"
        />
      ) : (
        <PlaceholderPortrait name={item.name} />
      )}
    </div>
  );
}

function filteredItems(items: TestimonialItem[]) {
  return items.filter(
    (item) => item.name.trim() || item.quote.trim() || item.affiliation.trim() || item.photoId,
  );
}

function retroCarouselCards(items: TestimonialItem[], activeIndex: number) {
  const count = items.length;
  if (count === 0) return [];

  const slots = count === 1 ? [0] : count === 2 ? [0, 1] : [-1, 0, 1];
  return slots.map((slot) => {
    const index = (activeIndex + slot + count) % count;
    return {
      item: items[index],
      index,
      slot,
    };
  });
}

type GlassStackPosition = "front" | "middle" | "back";

function glassStackCards(items: TestimonialItem[], activeIndex: number) {
  const count = items.length;
  if (count === 0) return [];

  const positions: GlassStackPosition[] =
    count === 1 ? ["front"] : count === 2 ? ["front", "middle"] : ["front", "middle", "back"];

  return positions.map((position, slotIndex) => {
    const index = (activeIndex + slotIndex) % count;
    return {
      item: items[index],
      index,
      position,
    };
  });
}

function TestimonialPortraitGridBlock({
  block,
  photoMap,
}: TestimonialSliderBlockProps) {
  const items = useMemo(() => filteredItems(block.items ?? []), [block.items]);
  const title = (block.title ?? "").trim() || "See what all the talk is about!";
  const subtitle = (block.subtitle ?? "").trim();
  const usePanel = block.gridPanel !== false;
  const gridColumns = block.gridColumns ?? "3";

  if (items.length === 0) {
    return (
      <Container className="py-14 sm:py-20">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
          Testimonials - add a review
        </div>
      </Container>
    );
  }

  return (
    <section className="testimonial-grid-block bg-[hsl(var(--background))] py-16 text-[hsl(var(--foreground))] sm:py-24">
      <Container>
        <div
          className={cn(
            "mx-auto px-4 py-12 text-center sm:px-7 sm:py-14",
            gridColumns === "2"
              ? "max-w-[52rem] lg:max-w-[49.5rem] lg:px-5"
              : "max-w-6xl lg:px-7",
            usePanel
              ? "rounded-[2rem] bg-neutral-950 text-white shadow-2xl shadow-black/20 sm:rounded-[2.5rem]"
              : "text-[hsl(var(--foreground))]",
          )}
        >
          <h2
            className={cn(
              "testimonial-grid-heading text-balance text-3xl font-bold tracking-tight sm:text-4xl",
              usePanel ? "text-white" : "text-[hsl(var(--foreground))]",
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className={cn(
                "testimonial-grid-subtitle mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:text-base",
                usePanel ? "text-white/60" : "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {subtitle}
            </p>
          )}

          <div
            className={cn(
              "mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2",
              gridColumns === "2"
                ? "mx-auto lg:max-w-[47rem] lg:grid-cols-2"
                : "lg:grid-cols-3",
            )}
          >
            {items.map((item, index) => {
              const photo = item.photoId ? photoMap.get(item.photoId) : undefined;
              const quoted = cleanQuote(item.quote);
              return (
                <figure
                  key={item.id}
                  className="testimonial-grid-card relative min-h-[30rem] overflow-hidden rounded-lg bg-neutral-900 text-left shadow-sm"
                  style={
                    {
                      "--testimonial-card-delay": `${index * 120}ms`,
                    } as CSSProperties
                  }
                >
                  <Portrait
                    item={item}
                    photo={photo}
                    priority={index < 3}
                    sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 360px"
                    className="absolute inset-0 h-full w-full rounded-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                    <Quote
                      className="mb-4 h-8 w-8 text-white/35"
                      aria-hidden="true"
                    />
                    {quoted && (
                      <blockquote className="text-sm font-medium leading-relaxed sm:text-base">
                        {quoted}
                      </blockquote>
                    )}
                    {(item.name || item.affiliation) && (
                      <p className="mt-4 text-sm font-semibold leading-relaxed">
                        {item.name && <span>&mdash; {item.name}</span>}
                        {item.affiliation && (
                          <span className={cn(item.name ? "text-white/60" : "ml-1 text-white/60")}>
                            {item.name ? `, ${item.affiliation}` : <>&mdash; {item.affiliation}</>}
                          </span>
                        )}
                      </p>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

interface TestimonialGlassStackBlockProps extends TestimonialSliderBlockProps {
  activeIndex: number;
  count: number;
  items: TestimonialItem[];
  onMove: (direction: -1 | 1) => void;
}

function TestimonialGlassStackBlock({
  activeIndex,
  count,
  items,
  onMove,
  block,
  photoMap,
}: TestimonialGlassStackBlockProps) {
  const cards = glassStackCards(items, activeIndex);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const label = (block.title || block.label || "Testimonials").trim();
  const useShowcaseBackground = block.glassShowcaseBackground !== false;
  const showcaseBackgroundColor =
    (block.glassShowcaseBackgroundColor ?? "").trim() || "#0d1324";
  const showcaseStyle = {
    backgroundColor: useShowcaseBackground ? showcaseBackgroundColor : "transparent",
  } satisfies CSSProperties;

  const resetDrag = () => {
    dragStart.current = null;
    setDragDelta(0);
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (count < 2) return;
    dragStart.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (Math.abs(dx) <= Math.abs(dy)) return;
    setDragDelta(Math.max(-66, Math.min(66, dx)));
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    resetDrag();

    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy)) {
      onMove(dx < 0 ? 1 : -1);
      return;
    }

    if (Math.abs(dx) < 9 && Math.abs(dy) < 9) {
      onMove(1);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (count < 2) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onMove(1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onMove(1);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onMove(-1);
    }
  };

  return (
    <section className="testimonial-glass-block overflow-x-clip bg-[hsl(var(--background))] py-14 text-[hsl(var(--foreground))] sm:py-20">
      <Container>
        <div
          className={cn(
            "testimonial-glass-stage relative mx-auto min-h-[31rem] max-w-6xl px-5 py-10 text-slate-50 sm:min-h-[37rem] sm:px-8 sm:py-14",
            useShowcaseBackground
              ? "overflow-hidden rounded-[2rem] shadow-2xl shadow-black/20 ring-1 ring-white/10 sm:rounded-[2.5rem]"
              : "overflow-visible rounded-none px-0 py-3 shadow-none ring-0 sm:py-6",
          )}
          style={showcaseStyle}
          aria-roledescription="carousel"
          aria-label={label}
          aria-live="polite"
        >
          {useShowcaseBackground && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_18%,rgba(124,141,255,0.24),transparent_31%),radial-gradient(circle_at_82%_70%,rgba(56,189,248,0.13),transparent_30%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_38%,rgba(255,255,255,0.04))]" />
            </>
          )}

          <div className="testimonial-glass-stack relative mx-auto h-[27rem] w-full max-w-[33rem] sm:h-[31rem] sm:max-w-[42rem]">
            {cards.map(({ item, index, position }) => {
              const photo = item.photoId ? photoMap.get(item.photoId) : undefined;
              const quoted = cleanQuote(item.quote);
              const isFront = position === "front";
              const slotStyles = {
                front: {
                  "--glass-x": "0px",
                  "--glass-y": "0px",
                  "--glass-rotate": "-5.5deg",
                  "--glass-scale": "1",
                  "--glass-opacity": "1",
                  "--glass-blur": "0px",
                  "--glass-enter-x": "-48px",
                  zIndex: 30,
                },
                middle: {
                  "--glass-x": "clamp(3.4rem, 14vw, 7.75rem)",
                  "--glass-y": "-0.35rem",
                  "--glass-rotate": "5.5deg",
                  "--glass-scale": "0.93",
                  "--glass-opacity": "0.74",
                  "--glass-blur": "1.5px",
                  "--glass-enter-x": "18px",
                  zIndex: 20,
                },
                back: {
                  "--glass-x": "clamp(5.4rem, 22vw, 13.25rem)",
                  "--glass-y": "1.35rem",
                  "--glass-rotate": "12deg",
                  "--glass-scale": "0.86",
                  "--glass-opacity": "0.42",
                  "--glass-blur": "3.5px",
                  "--glass-enter-x": "56px",
                  zIndex: 10,
                },
              } satisfies Record<GlassStackPosition, CSSPropertiesWithVars>;
              const style = {
                ...slotStyles[position],
                "--glass-drag-x": isFront ? `${dragDelta}px` : "0px",
                "--glass-delay": `${index === activeIndex ? 0 : 60}ms`,
              } satisfies CSSPropertiesWithVars;

              return (
                <figure
                  key={`${item.id}-${position}-${activeIndex}`}
                  className={cn(
                    "testimonial-glass-card absolute flex h-[23.5rem] w-[17.75rem] flex-col overflow-hidden rounded-[1.65rem] border px-6 py-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.36)] backdrop-blur-2xl sm:h-[28rem] sm:w-[21rem] sm:rounded-[2rem] sm:px-8 sm:py-8",
                    useShowcaseBackground
                      ? "border-white/20 bg-white/[0.085]"
                      : "border-white/15 bg-slate-950/80",
                    isFront ? "cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none",
                  )}
                  data-slot={position}
                  style={style}
                  role={isFront ? "button" : undefined}
                  tabIndex={isFront ? 0 : -1}
                  aria-hidden={isFront ? undefined : true}
                  aria-label={isFront ? "Show next testimonial" : undefined}
                  onPointerDown={isFront ? handlePointerDown : undefined}
                  onPointerMove={isFront ? handlePointerMove : undefined}
                  onPointerUp={isFront ? handlePointerUp : undefined}
                  onPointerCancel={isFront ? resetDrag : undefined}
                  onKeyDown={isFront ? handleKeyDown : undefined}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(255,255,255,0.035)_44%,rgba(255,255,255,0.11))]" />
                  <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/10" />
                  <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-full bg-slate-800 ring-1 ring-white/25 shadow-[0_12px_32px_rgba(0,0,0,0.34)] sm:h-24 sm:w-24">
                    {photo ? (
                      <ResponsiveImage
                        photo={photo}
                        sizes="(max-width: 767px) 96px, 112px"
                        priority={isFront}
                        className="h-full w-full"
                      />
                    ) : (
                      <PlaceholderPortrait
                        name={item.name}
                        className="bg-slate-800 text-base text-slate-100"
                      />
                    )}
                  </div>

                  {quoted && (
                    <blockquote className="relative mt-7 text-balance font-serif text-[1.05rem] italic leading-relaxed text-white/92 sm:mt-8 sm:text-[1.24rem]">
                      &quot;{quoted}&quot;
                    </blockquote>
                  )}

                  {(item.name || item.affiliation) && (
                    <figcaption className="relative mt-auto pt-6 text-sm font-semibold leading-relaxed text-[#aebcff] sm:text-base">
                      {item.name}
                      {item.affiliation && (
                        <span className="text-slate-300/72"> - {item.affiliation}</span>
                      )}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}

interface TestimonialRetroCarouselBlockProps extends TestimonialSliderBlockProps {
  activeIndex: number;
  count: number;
  items: TestimonialItem[];
  onMove: (direction: -1 | 1) => void;
  onSelect: (index: number) => void;
}

function TestimonialRetroCarouselBlock({
  activeIndex,
  count,
  items,
  onMove,
  onSelect,
  photoMap,
}: TestimonialRetroCarouselBlockProps) {
  const cards = retroCarouselCards(items, activeIndex);

  return (
    <section className="testimonial-retro-block bg-[hsl(var(--background))] py-14 text-[hsl(var(--foreground))] sm:py-20">
      <Container>
        <div
          className="testimonial-retro-stage relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#faf8f1] px-0 py-10 text-[#423c33] shadow-sm ring-1 ring-black/5 dark:bg-[#15120e] dark:text-[#f3eadc] dark:ring-white/10 sm:rounded-[2.5rem] sm:py-14"
          aria-roledescription="carousel"
          aria-label="Retro testimonial carousel"
        >
          <div className="testimonial-retro-track relative mx-0 flex min-h-[31rem] items-stretch justify-center gap-5 sm:mx-[-5.5rem] sm:min-h-[36rem] sm:gap-7 lg:mx-[-9rem] lg:gap-8">
            {cards.map(({ item, index, slot }) => {
              const photo = item.photoId ? photoMap.get(item.photoId) : undefined;
              const quoted = cleanQuote(item.quote);
              const isActive = slot === 0;
              const style = {
                "--retro-x": slot === -1 ? "-0.25rem" : slot === 1 ? "0.25rem" : "0px",
                "--retro-y": isActive ? "0px" : "0.9rem",
                "--retro-rotate": slot === -1 ? "-1.2deg" : slot === 1 ? "1.15deg" : "2deg",
                "--retro-scale": isActive ? "1" : "0.975",
                "--retro-opacity": isActive ? "1" : "0.9",
                "--retro-enter-x": slot === -1 ? "-32px" : slot === 1 ? "32px" : "0px",
                "--retro-enter-rotate": slot === -1 ? "-4deg" : slot === 1 ? "4deg" : "0.5deg",
                "--retro-delay": `${Math.abs(slot) * 45}ms`,
              } as CSSProperties;

              return (
                <figure
                  key={`${item.id}-${slot}-${activeIndex}`}
                  className={cn(
                    "testimonial-retro-card relative flex min-h-[31rem] w-[min(82vw,23.5rem)] shrink-0 flex-col items-center overflow-hidden rounded-[1.65rem] border border-[#d9d0bd]/70 bg-gradient-to-b from-[#f2f0eb] to-[#fff9eb] px-7 py-9 text-center shadow-[0_18px_48px_rgba(82,67,47,0.16)] dark:border-white/10 dark:from-[#201b14] dark:to-[#2a241b] dark:shadow-black/40 sm:min-h-[36rem] sm:w-[22rem] sm:px-8 sm:py-10 md:w-[23.5rem] lg:w-[24rem]",
                    isActive ? "z-20" : "z-10 hidden sm:flex",
                    !isActive && "cursor-pointer",
                  )}
                  style={style}
                  aria-hidden={isActive ? undefined : "true"}
                  onClick={() => {
                    if (!isActive) onSelect(index);
                  }}
                >
                  <div className="testimonial-retro-paper pointer-events-none absolute inset-0" />
                  <div className="testimonial-retro-avatar relative mt-5 h-28 w-28 overflow-hidden rounded-full border-2 bg-[#2f2b24] shadow-[0_7px_18px_rgba(48,39,28,0.14)] dark:shadow-black/25 sm:h-32 sm:w-32">
                    {photo ? (
                      <ResponsiveImage
                        photo={photo}
                        sizes="(max-width: 767px) 128px, 144px"
                        priority={isActive}
                        className="h-full w-full"
                      />
                    ) : (
                      <PlaceholderPortrait
                        name={item.name}
                        className="bg-[#343029] text-[#efe5d2] grayscale"
                      />
                    )}
                  </div>

                  {quoted && (
                    <blockquote className="testimonial-retro-quote relative mt-10 max-w-[23rem] text-balance text-[clamp(1.35rem,4.8vw,1.95rem)] font-normal lowercase leading-[1.24] text-[#474139] dark:text-[#f4ecdc] sm:mt-12 md:text-[clamp(1.65rem,2.25vw,2.15rem)]">
                      {quoted}
                    </blockquote>
                  )}

                  {(item.name || item.affiliation) && (
                    <figcaption className="relative mt-auto pt-8 font-serif italic lowercase">
                      {item.name && (
                        <p className="text-[1.7rem] leading-tight text-[#746a5a] dark:text-[#e4d8c1]">
                          {withTerminalDot(item.name)}
                        </p>
                      )}
                      {item.affiliation && (
                        <p className="mt-2 inline-block border-b border-[#665d50] px-2 pb-1 text-[1.15rem] leading-tight text-[#8a8171] dark:border-[#d8ceb9] dark:text-[#cfc1a9]">
                          {item.affiliation}
                        </p>
                      )}
                    </figcaption>
                  )}
                </figure>
              );
            })}
          </div>

          <div className="absolute bottom-5 right-5 z-30 flex items-center gap-3 sm:bottom-7 sm:right-8">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={() => onMove(-1)}
              disabled={count < 2}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4d3d2e] text-[#fff8ed] shadow-sm transition hover:scale-105 hover:bg-[#3f3023] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#efe2ca] dark:text-[#201a14] dark:hover:bg-[#fff2da]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={() => onMove(1)}
              disabled={count < 2}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4d3d2e] text-[#fff8ed] shadow-sm transition hover:scale-105 hover:bg-[#3f3023] disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#efe2ca] dark:text-[#201a14] dark:hover:bg-[#fff2da]"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function TestimonialSliderBlock({
  block,
  photoMap,
}: TestimonialSliderBlockProps) {
  const reducedMotion = useReducedMotion();
  const items = useMemo(() => filteredItems(block.items ?? []), [block.items]);
  const [active, setActive] = useState(0);
  const count = items.length;
  const safeActive = count > 0 ? Math.min(active, count - 1) : 0;
  const activeItem = items[safeActive];
  const activePhoto = activeItem?.photoId ? photoMap.get(activeItem.photoId) : undefined;
  const thumbnailIndexes = useMemo(() => {
    if (count <= 3) return items.map((_, index) => index);
    const start = Math.min(Math.max(safeActive - 1, 0), count - 3);
    return [start, start + 1, start + 2];
  }, [count, items, safeActive]);

  useEffect(() => {
    if (active >= count) setActive(Math.max(0, count - 1));
  }, [active, count]);

  useEffect(() => {
    if (!block.autoplay || reducedMotion || count < 2) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [block.autoplay, count, reducedMotion]);

  if (!activeItem) {
    return (
      <Container className="py-14 sm:py-20">
        <div className="mx-auto flex min-h-64 max-w-5xl items-center justify-center rounded-lg border border-dashed text-sm text-[hsl(var(--muted-foreground))]">
          Testimonials - add a review
        </div>
      </Container>
    );
  }

  const go = (direction: -1 | 1) => {
    if (count < 2) return;
    setActive((current) => (current + direction + count) % count);
  };

  const quoted = cleanQuote(activeItem.quote);
  const label = (block.label || "Reviews").trim();

  if (block.layout === "portrait-grid") {
    return <TestimonialPortraitGridBlock block={block} photoMap={photoMap} />;
  }

  if (block.layout === "retro-carousel") {
    return (
      <TestimonialRetroCarouselBlock
        block={block}
        photoMap={photoMap}
        items={items}
        activeIndex={safeActive}
        count={count}
        onMove={go}
        onSelect={setActive}
      />
    );
  }

  if (block.layout === "glass-stack") {
    return (
      <TestimonialGlassStackBlock
        block={block}
        photoMap={photoMap}
        items={items}
        activeIndex={safeActive}
        count={count}
        onMove={go}
      />
    );
  }

  return (
    <section className="testimonial-slider-block bg-[hsl(var(--background))] py-14 text-[hsl(var(--foreground))] sm:py-20">
      <Container>
        <div className="testimonial-slider-stage mx-auto grid max-w-6xl gap-8 md:min-h-[640px] md:grid-cols-[8rem_minmax(15rem,21rem)_minmax(17rem,1fr)] md:items-center md:gap-12 lg:gap-16">
          <div className="order-1 flex items-center justify-between gap-5 md:order-none md:flex-col md:items-start md:self-stretch md:py-16">
            <div className="flex items-center gap-3 md:block">
              <p className="font-mono text-sm tracking-wide text-[hsl(var(--muted-foreground))]">
                {String(safeActive + 1).padStart(2, "0")}
                <span className="px-2 text-[hsl(var(--border))]">/</span>
                {String(count).padStart(2, "0")}
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] md:mt-5 md:[writing-mode:vertical-rl]">
                {label}
              </p>
            </div>

            {block.showThumbnails !== false && (
              <div className="testimonial-slider-thumbs flex max-w-[52vw] items-end gap-2 overflow-x-auto pb-1 md:max-w-none md:pb-0">
                {thumbnailIndexes.map((index) => {
                  const item = items[index];
                  const photo = item.photoId ? photoMap.get(item.photoId) : undefined;
                  const selected = index === safeActive;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={`Show testimonial ${index + 1}`}
                      aria-current={selected ? "true" : undefined}
                      onClick={() => setActive(index)}
                      className={cn(
                        "h-20 w-10 shrink-0 overflow-hidden rounded-lg bg-[hsl(var(--muted))] transition duration-300 sm:h-24 sm:w-12",
                        selected
                          ? "opacity-100 ring-1 ring-[hsl(var(--foreground))]"
                          : "opacity-45 hover:opacity-80",
                      )}
                    >
                      {photo ? (
                        <ResponsiveImage
                          photo={photo}
                          sizes="64px"
                          className="h-full w-full"
                        />
                      ) : (
                        <PlaceholderPortrait name={item.name} className="text-xs" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Portrait
            key={`portrait-${activeItem.id}`}
            item={activeItem}
            photo={activePhoto}
            priority={safeActive === 0}
            className="testimonial-slider-portrait order-2 mx-auto aspect-[0.74] w-full max-w-[18rem] md:order-none md:aspect-[2/3] md:max-w-none"
          />

          <div
            key={`copy-${activeItem.id}`}
            className="testimonial-slider-copy order-3 max-w-[28rem] justify-self-start md:order-none"
            aria-live="polite"
          >
            {activeItem.affiliation && (
              <p className="mb-2 text-sm font-semibold text-[hsl(var(--muted-foreground))]">
                {activeItem.affiliation}
              </p>
            )}
            {activeItem.name && (
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                {activeItem.name}
              </h2>
            )}
            <blockquote className="mt-8 text-[clamp(1.9rem,4.8vw,3.25rem)] font-bold leading-[1.18] tracking-[-0.01em] md:mt-9 md:text-[clamp(2.1rem,3.1vw,3.6rem)]">
              &quot;{quoted}&quot;
            </blockquote>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() => go(-1)}
                disabled={count < 2}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))] disabled:opacity-40"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() => go(1)}
                disabled={count < 2}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--foreground))] text-[hsl(var(--background))] transition hover:opacity-85 disabled:opacity-40"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
