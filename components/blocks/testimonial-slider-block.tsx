"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type TestimonialsBlockData = Extract<LeafBlock, { type: "testimonials" }>;
type TestimonialItem = TestimonialsBlockData["items"][number];

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
}: {
  item: TestimonialItem;
  photo?: PhotoDTO;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg bg-[hsl(var(--muted))]", className)}>
      {photo ? (
        <ResponsiveImage
          photo={photo}
          sizes="(max-width: 767px) 78vw, 360px"
          priority={priority}
          className="h-full w-full"
        />
      ) : (
        <PlaceholderPortrait name={item.name} />
      )}
    </div>
  );
}

export function TestimonialSliderBlock({
  block,
  photoMap,
}: TestimonialSliderBlockProps) {
  const reducedMotion = useReducedMotion();
  const items = useMemo(
    () =>
      (block.items ?? []).filter(
        (item) => item.name.trim() || item.quote.trim() || item.affiliation.trim() || item.photoId,
      ),
    [block.items],
  );
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
