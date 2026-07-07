"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";

export interface ToraProgressSliderItem {
  id: string;
  title: string;
  category: string;
  linkHref?: string | null;
  photo?: PhotoDTO;
}

type CSSVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

const SlideLink = forwardRef<
  HTMLAnchorElement | HTMLDivElement,
  {
  href?: string | null;
  className?: string;
  children: ReactNode;
  }
>(function SlideLink({
  href,
  className,
  children,
}, ref) {
  const cleanHref = (href ?? "").trim();
  if (!cleanHref || cleanHref === "#") {
    return (
      <div ref={ref as Ref<HTMLDivElement>} className={className}>
        {children}
      </div>
    );
  }
  if (isExternalHref(cleanHref)) {
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={cleanHref}
        className={className}
        target="_blank"
        rel="noreferrer noopener"
      >
        {children}
      </a>
    );
  }
  return (
    <Link
      ref={ref as Ref<HTMLAnchorElement>}
      href={cleanHref}
      className={className}
    >
      {children}
    </Link>
  );
});

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ToraProgressSlider({
  items,
}: {
  items: ToraProgressSliderItem[];
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | HTMLAnchorElement | null>>([]);
  const [progress, setProgress] = useState(0);
  const [loopReady, setLoopReady] = useState(false);
  const cloneCount = items.length > 1 ? Math.min(3, items.length) : 0;
  const loopItems = useMemo(() => {
    if (cloneCount === 0) {
      return items.map((item, index) => ({
        item,
        key: item.id,
        originalIndex: index,
        clone: false,
      }));
    }
    const left = items.slice(-cloneCount).map((item, index) => ({
      item,
      key: `left-${index}-${item.id}`,
      originalIndex: items.length - cloneCount + index,
      clone: true,
    }));
    const center = items.map((item, index) => ({
      item,
      key: `real-${index}-${item.id}`,
      originalIndex: index,
      clone: false,
    }));
    const right = items.slice(0, cloneCount).map((item, index) => ({
      item,
      key: `right-${index}-${item.id}`,
      originalIndex: index,
      clone: true,
    }));
    return [...left, ...center, ...right];
  }, [cloneCount, items]);

  const centeredScrollFor = useCallback((element: HTMLElement, scroller: HTMLElement) => {
    const previousPeek = Math.min(90, Math.max(24, scroller.clientWidth * 0.04));
    return element.offsetLeft - (scroller.clientWidth - element.offsetWidth) / 2 - previousPeek;
  }, []);

  const loopBounds = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || cloneCount === 0) return null;
    const firstReal = slideRefs.current[cloneCount];
    const firstRightClone = slideRefs.current[cloneCount + items.length];
    if (!firstReal || !firstRightClone) return null;
    const start = centeredScrollFor(firstReal, scroller);
    const end = centeredScrollFor(firstRightClone, scroller);
    const span = end - start;
    if (span <= 1) return null;
    return { scroller, start, end, span };
  }, [centeredScrollFor, cloneCount, items.length]);

  const syncProgress = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const bounds = loopBounds();
    if (bounds) {
      const offset =
        ((scroller.scrollLeft - bounds.start) % bounds.span + bounds.span) %
        bounds.span;
      setProgress(offset / bounds.span);
      return;
    }
    const max = scroller.scrollWidth - scroller.clientWidth;
    if (max <= 1) {
      setProgress(1);
      return;
    }
    setProgress(Math.min(1, Math.max(0, scroller.scrollLeft / max)));
  }, [loopBounds]);

  const wrapLoopPosition = useCallback(() => {
    const bounds = loopBounds();
    if (!bounds) return false;
    const { scroller, start, end, span } = bounds;
    if (scroller.scrollLeft < start - 1) {
      scroller.scrollLeft += span;
      return true;
    }
    if (scroller.scrollLeft >= end - 1) {
      scroller.scrollLeft -= span;
      return true;
    }
    return false;
  }, [loopBounds]);

  useLayoutEffect(() => {
    const bounds = loopBounds();
    if (!bounds) {
      setLoopReady(true);
      return;
    }
    bounds.scroller.scrollLeft = bounds.start;
    setLoopReady(true);
    syncProgress();
  }, [loopBounds, syncProgress]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    syncProgress();
    const onScroll = () => {
      wrapLoopPosition();
      syncProgress();
    };
    const resizeObserver = new ResizeObserver(syncProgress);

    scroller.addEventListener("scroll", onScroll, { passive: true });
    resizeObserver.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [syncProgress, wrapLoopPosition]);

  const move = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    wrapLoopPosition();
    scroller.scrollBy({
      left: direction * Math.max(320, scroller.clientWidth * 0.72),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  return (
    <div
      className={`tora-progress-slider ${loopReady ? "is-loop-ready" : ""}`}
      style={{ "--tora-progress": progress } as CSSVars}
    >
      <div
        ref={scrollerRef}
        className="tora-progress-slider__track"
        tabIndex={0}
        aria-label="Featured galleries"
      >
        {loopItems.map(({ item, key, originalIndex, clone }, index) => {
          const ratio =
            item.photo && item.photo.height > 0
              ? item.photo.width / item.photo.height
              : 1.48;
          const slideStyle = { "--tora-slide-ratio": ratio } as CSSVars;
          const media = (
              <div
                className="tora-progress-slider__media"
                style={slideStyle}
              >
                {item.photo ? (
                  <ResponsiveImage
                    photo={item.photo}
                    sizes="(min-width: 1200px) 46vw, (min-width: 768px) 68vw, 100vw"
                    priority={originalIndex === 0 && !clone}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="portfolio-list-placeholder" aria-hidden="true" />
                )}
                <div className="tora-progress-slider__overlay" aria-hidden="true" />
                <div className="tora-progress-slider__copy">
                  <h3>{item.title}</h3>
                  {item.category && <p>{item.category}</p>}
                </div>
              </div>
          );
          if (clone) {
            return (
              <div
                key={key}
                ref={(node) => {
                  slideRefs.current[index] = node;
                }}
                className="tora-progress-slider__slide"
                aria-hidden="true"
              >
                {media}
              </div>
            );
          }
          return (
            <SlideLink
              key={key}
              href={item.linkHref}
              className="tora-progress-slider__slide"
              ref={(node) => {
                slideRefs.current[index] = node;
              }}
            >
              {media}
            </SlideLink>
          );
        })}
      </div>

      <div className="tora-progress-slider__progress" aria-hidden="true">
        <span />
      </div>

      <div className="tora-progress-slider__controls">
        <button type="button" onClick={() => move(-1)}>
          <span aria-hidden="true">←</span>
          Scroll
        </button>
        <button type="button" onClick={() => move(1)}>
          Scroll
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
