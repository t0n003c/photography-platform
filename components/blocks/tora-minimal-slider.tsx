"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";

export interface ToraMinimalSliderItem {
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

function SliderLink({
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

export function ToraMinimalSlider({
  items,
  height,
  autoplay = false,
  autoplayMs = 4500,
}: {
  items: ToraMinimalSliderItem[];
  height: "short" | "tall" | "full";
  autoplay?: boolean;
  autoplayMs?: number;
}) {
  const slides = useMemo(
    () =>
      items.length > 0
        ? items
        : [
            {
              id: "empty",
              subtitle: "for couples",
              headline: "Another way",
              buttonLabel: "Read More",
              buttonHref: "#",
            },
          ],
    [items],
  );
  const [active, setActive] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [transitionDirection, setTransitionDirection] = useState<-1 | 1>(1);
  const [paused, setPaused] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
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

  const go = useCallback(
    (direction: -1 | 1) => {
      if (!hasMultiple) return;
      const next = (active + direction + max) % max;
      if (next === active) return;
      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      setTransitionDirection(direction);
      setLeavingIndex(active);
      setActive(next);
      transitionTimer.current = window.setTimeout(() => {
        setLeavingIndex(null);
      }, 760);
    },
    [active, hasMultiple, max],
  );

  useEffect(() => {
    if (!autoplay || paused || reducedMotion || !hasMultiple) return;
    const delay = Math.max(1200, Math.min(12000, autoplayMs));
    const timer = window.setInterval(() => go(1), delay);
    return () => window.clearInterval(timer);
  }, [autoplay, autoplayMs, go, hasMultiple, paused, reducedMotion]);

  const finishSwipe = useCallback(
    (clientX: number, clientY: number) => {
      const start = pointerStart.current;
      pointerStart.current = null;
      setPaused(false);
      if (!start) return;
      const deltaX = clientX - start.x;
      const deltaY = clientY - start.y;
      if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return;
      if (deltaX < 0) go(1);
      else go(-1);
    },
    [go],
  );

  const cancelSwipe = () => {
    pointerStart.current = null;
    setPaused(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (!hasMultiple) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    setPaused(true);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    finishSwipe(event.clientX, event.clientY);
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!hasMultiple) return;
    const touch = event.touches[0];
    if (!touch) return;
    pointerStart.current = { x: touch.clientX, y: touch.clientY };
    setPaused(true);
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) {
      cancelSwipe();
      return;
    }
    finishSwipe(touch.clientX, touch.clientY);
  };

  return (
    <section
      className={cn("tora-minimal-slider", `tora-minimal-slider--${height}`)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="tora-minimal-slider__stage" aria-roledescription="carousel">
        <div
          className={cn(
            "tora-minimal-slider__viewport",
            transitionDirection === 1 ? "is-forward" : "is-backward",
          )}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={(event) => {
            if (event.pointerType !== "touch") cancelSwipe();
          }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchCancel={cancelSwipe}
        >
          {slides.map((slide, index) => {
            const isActive = index === active;
            const isLeaving = index === leavingIndex;
            return (
              <article
                key={slide.id}
                className={cn(
                  "tora-minimal-slider__slide",
                  isActive && "is-active",
                  isLeaving && "is-leaving",
                )}
                aria-hidden={!isActive}
              >
                {slide.photo ? (
                  <ResponsiveImage
                    photo={slide.photo}
                    sizes="(max-width: 768px) calc(100vw - 32px), calc(100vw - 18rem)"
                    priority={index === 0}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[hsl(var(--muted))]" />
                )}
                <div className="tora-minimal-slider__shade" aria-hidden="true" />
                <div className="tora-minimal-slider__caption">
                  {slide.subtitle.trim() && (
                    <p className="tora-minimal-slider__subtitle">{slide.subtitle}</p>
                  )}
                  {slide.headline.trim() && (
                    <h1 className="tora-minimal-slider__title">{slide.headline}</h1>
                  )}
                  {slide.buttonLabel.trim() && (
                    <SliderLink
                      href={slide.buttonHref}
                      className="tora-minimal-slider__button"
                      tabIndex={isActive ? undefined : -1}
                    >
                      {slide.buttonLabel}
                    </SliderLink>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="tora-minimal-slider__arrow is-prev"
              onClick={() => go(-1)}
              aria-label="Previous slide"
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="tora-minimal-slider__arrow is-next"
              onClick={() => go(1)}
              aria-label="Next slide"
            >
              <span aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
