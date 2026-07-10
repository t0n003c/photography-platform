"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export interface ToraFullWidthSliderItem {
  id: string;
  subtitle: string;
  headline: string;
  buttonLabel: string;
  buttonHref: string;
  photo?: PhotoDTO;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function SliderTitleLink({
  href,
  className,
  tabIndex,
  children,
}: {
  href?: string | null;
  className?: string;
  tabIndex?: number;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <span className={className} tabIndex={tabIndex}>
        {children}
      </span>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
        tabIndex={tabIndex}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={cleanHref} className={className} tabIndex={tabIndex}>
      {children}
    </Link>
  );
}

export function ToraFullWidthSlider({
  items,
  height,
  autoplay = true,
  autoplayMs = 5000,
  accentColor = "#f7f7f7",
  dimImages = true,
}: {
  items: ToraFullWidthSliderItem[];
  height: "short" | "tall" | "full";
  autoplay?: boolean;
  autoplayMs?: number;
  accentColor?: string;
  dimImages?: boolean;
}) {
  const slides = useMemo(
    () =>
      items.length > 0
        ? items
        : [
            {
              id: "empty",
              subtitle: "",
              headline: "London's portraits",
              buttonLabel: "",
              buttonHref: "#",
            },
          ],
    [items],
  );
  const [active, setActive] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const max = slides.length;
  const hasMultiple = max > 1;

  useEffect(() => {
    if (active < max) return;
    setLeavingIndex(null);
    setActive(0);
  }, [active, max]);

  useEffect(
    () => () => {
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    },
    [],
  );

  const goTo = useCallback(
    (next: number) => {
      if (!hasMultiple) return;
      const normalized = (next + max) % max;
      if (normalized === active) return;
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      setLeavingIndex(active);
      setActive(normalized);
      transitionTimer.current = window.setTimeout(() => {
        setLeavingIndex(null);
      }, 1500);
    },
    [active, hasMultiple, max],
  );

  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);

  useEffect(() => {
    if (!autoplay || paused || reducedMotion || !hasMultiple) return;
    const delay = Math.max(1200, Math.min(12000, autoplayMs));
    const timer = window.setInterval(goNext, delay);
    return () => window.clearInterval(timer);
  }, [autoplay, autoplayMs, goNext, hasMultiple, paused, reducedMotion]);

  return (
    <section
      className={cn("tora-full-width-slider", `tora-full-width-slider--${height}`)}
      style={{ "--tora-full-accent": accentColor } as CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="tora-full-width-slider__stage"
        aria-label="Portfolio image slider"
        aria-roledescription="carousel"
      >
        {slides.map((slide, index) => {
          const isActive = index === active;
          const isLeaving = index === leavingIndex;
          const title = slide.headline.trim() || slide.subtitle.trim();
          return (
            <article
              key={slide.id}
              className={cn(
                "tora-full-width-slider__slide",
                isActive && "is-active",
                isLeaving && "is-leaving",
              )}
              aria-hidden={!isActive}
            >
              {slide.photo ? (
                <ResponsiveImage
                  photo={slide.photo}
                  sizes="100vw"
                  priority={index === 0}
                  className="h-full w-full"
                />
              ) : (
                <div className="h-full w-full bg-[#252626]" />
              )}
              {dimImages && (
                <div className="tora-full-width-slider__shade" aria-hidden="true" />
              )}
              {title && (
                <div className="tora-full-width-slider__content">
                  <SliderTitleLink
                    href={slide.buttonHref}
                    className="tora-full-width-slider__title"
                    tabIndex={isActive ? undefined : -1}
                  >
                    {title}
                  </SliderTitleLink>
                </div>
              )}
            </article>
          );
        })}
        {hasMultiple && (
          <div className="tora-full-width-slider__pagination" aria-label="Choose slide">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={cn(
                  "tora-full-width-slider__dot",
                  index === active && "is-active",
                )}
                onClick={() => goTo(index)}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === active ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
