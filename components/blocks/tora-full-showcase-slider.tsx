"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";

export interface ToraFullShowcaseSliderItem {
  id: string;
  title: string;
  linkHref?: string | null;
  photo?: PhotoDTO;
}

type CSSVars = CSSProperties & { [key: `--${string}`]: string | number | undefined };

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function currentSlidesPerView() {
  if (typeof window === "undefined") return 3;
  if (window.innerWidth < 768) return 1;
  if (window.innerWidth < 992) return 2;
  return 3;
}

function SlideLink({
  href,
  className,
  ariaHidden,
  children,
}: {
  href?: string | null;
  className?: string;
  ariaHidden?: boolean;
  children: ReactNode;
}) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <div className={className} aria-hidden={ariaHidden || undefined}>
        {children}
      </div>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        href={cleanHref}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
        aria-hidden={ariaHidden || undefined}
        tabIndex={ariaHidden ? -1 : undefined}
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      href={cleanHref}
      className={className}
      aria-hidden={ariaHidden || undefined}
      tabIndex={ariaHidden ? -1 : undefined}
    >
      {children}
    </Link>
  );
}

export function ToraFullShowcaseSlider({
  items,
}: {
  items: ToraFullShowcaseSliderItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [enhanced, setEnhanced] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [slidesPerView, setSlidesPerView] = useState(3);
  const itemCount = items.length;
  const intervalRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const displayItems = useMemo(() => {
    if (itemCount === 0) return [];
    if (itemCount === 1) return items;
    return [...items, ...items.slice(0, Math.min(3, itemCount))];
  }, [itemCount, items]);

  const clearAutoplay = useCallback(() => {
    if (intervalRef.current === null) return;
    window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const startAutoplay = useCallback(() => {
    clearAutoplay();
    if (itemCount <= 1 || prefersReducedMotion()) return;
    intervalRef.current = window.setInterval(() => {
      setActiveIndex((current) => current + 1);
    }, 2500);
  }, [clearAutoplay, itemCount]);

  useEffect(() => {
    setEnhanced(!prefersReducedMotion());
    setSlidesPerView(currentSlidesPerView());
    startAutoplay();

    const onResize = () => setSlidesPerView(currentSlidesPerView());

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      setEnhanced(!motionQuery.matches);
      if (motionQuery.matches) {
        clearAutoplay();
      } else {
        startAutoplay();
      }
    };

    window.addEventListener("resize", onResize);
    motionQuery.addEventListener?.("change", onMotionChange);
    return () => {
      clearAutoplay();
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
      window.removeEventListener("resize", onResize);
      motionQuery.removeEventListener?.("change", onMotionChange);
    };
  }, [clearAutoplay, startAutoplay]);

  useEffect(() => {
    if (itemCount <= 1 || activeIndex < itemCount) return;
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setTransitionEnabled(false);
      setActiveIndex(0);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
    }, 1500);
  }, [activeIndex, itemCount]);

  if (displayItems.length === 0) return null;

  const offset = `-${activeIndex * (100 / slidesPerView)}%`;

  return (
    <div
      className={`tora-full-showcase-slider ${enhanced ? "is-enhanced" : "is-static"} ${
        transitionEnabled ? "" : "is-resetting"
      }`}
      onMouseEnter={clearAutoplay}
      onMouseLeave={startAutoplay}
      onFocus={clearAutoplay}
      onBlur={startAutoplay}
      style={
        {
          "--tora-showcase-index": activeIndex,
          "--tora-showcase-offset": offset,
        } as CSSVars
      }
    >
      <div className="tora-full-showcase-slider__viewport">
        <div className="tora-full-showcase-slider__track">
          {displayItems.map((item, index) => {
            const isClone = index >= itemCount;
            const visibleIndex = index % itemCount;
            return (
              <SlideLink
                href={item.linkHref}
                className="tora-full-showcase-slider__slide"
                ariaHidden={isClone}
                key={`${isClone ? "clone" : "slide"}-${index}-${item.id}`}
              >
                <span className="tora-full-showcase-slider__media">
                  {item.photo ? (
                    <ResponsiveImage
                      photo={item.photo}
                      sizes="(min-width: 992px) 33vw, (min-width: 640px) 50vw, 100vw"
                      priority={visibleIndex === 0 && !isClone}
                      className="h-full w-full"
                    />
                  ) : (
                    <span className="tora-full-showcase-slider__placeholder" aria-hidden="true" />
                  )}
                </span>
                <span className="tora-full-showcase-slider__overlay" aria-hidden="true" />
                <span className="tora-full-showcase-slider__title">
                  {item.title || `Portfolio ${visibleIndex + 1}`}
                </span>
              </SlideLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
