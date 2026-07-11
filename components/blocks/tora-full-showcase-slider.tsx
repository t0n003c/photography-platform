"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
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

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  locked: boolean;
};

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
  const itemCount = items.length;
  const cloneCount = itemCount > 1 ? Math.min(3, itemCount) : 0;
  const [activeIndex, setActiveIndex] = useState(() => cloneCount);
  const [enhanced, setEnhanced] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [slidesPerView, setSlidesPerView] = useState(3);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const displayItems = useMemo(() => {
    if (itemCount === 0) return [];
    if (itemCount === 1) return items;
    return [
      ...items.slice(-cloneCount),
      ...items,
      ...items.slice(0, cloneCount),
    ];
  }, [cloneCount, itemCount, items]);

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

  const moveBy = useCallback(
    (delta: -1 | 1) => {
      clearAutoplay();
      setTransitionEnabled(true);
      setActiveIndex((current) => current + delta);
    },
    [clearAutoplay],
  );

  useEffect(() => {
    setActiveIndex(cloneCount);
    setDragOffset(0);
  }, [cloneCount, itemCount]);

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
    if (cloneCount === 0 || itemCount <= 1) return;
    const firstRealIndex = cloneCount;
    const afterLastRealIndex = cloneCount + itemCount;
    if (activeIndex >= firstRealIndex && activeIndex < afterLastRealIndex) return;

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setTransitionEnabled(false);
      setActiveIndex(() => {
        const raw = activeIndex - firstRealIndex;
        const normalized = ((raw % itemCount) + itemCount) % itemCount;
        return firstRealIndex + normalized;
      });
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setTransitionEnabled(true));
      });
    }, 1500);
  }, [activeIndex, cloneCount, itemCount]);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    setDragOffset(0);
    startAutoplay();
  }, [startAutoplay]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (itemCount <= 1) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        locked: false,
      };
    },
    [itemCount],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!drag.locked) {
        if (absY > 10 && absY > absX * 1.15) {
          cancelDrag();
          return;
        }
        if (absX < 12 || absX <= absY) return;

        drag.locked = true;
        clearAutoplay();
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }

      drag.lastX = event.clientX;
      setDragOffset(dx);
      event.preventDefault();
    },
    [cancelDrag, clearAutoplay],
  );

  const finishDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      const dx = drag.lastX - drag.startX;
      const slideWidth =
        event.currentTarget.getBoundingClientRect().width / Math.max(1, slidesPerView);
      const threshold = Math.min(180, Math.max(48, slideWidth * 0.16));

      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (drag.locked) {
        suppressClickRef.current = true;
        setDragging(false);
        setDragOffset(0);
        if (Math.abs(dx) >= threshold) {
          moveBy(dx < 0 ? 1 : -1);
        } else {
          setTransitionEnabled(true);
        }
      }

      startAutoplay();
    },
    [moveBy, slidesPerView, startAutoplay],
  );

  const onClickCapture = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  if (displayItems.length === 0) return null;

  const offset = `-${activeIndex * (100 / slidesPerView)}%`;

  return (
    <div
      className={`tora-full-showcase-slider ${enhanced ? "is-enhanced" : "is-static"} ${
        transitionEnabled ? "" : "is-resetting"
      } ${dragging ? "is-dragging" : ""}`}
      onMouseEnter={clearAutoplay}
      onMouseLeave={startAutoplay}
      onFocus={clearAutoplay}
      onBlur={startAutoplay}
      onClickCapture={onClickCapture}
      onPointerCancel={cancelDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onDragStart={(event) => event.preventDefault()}
      style={
        {
          "--tora-showcase-index": activeIndex,
          "--tora-showcase-offset": offset,
          "--tora-showcase-drag": `${dragOffset}px`,
        } as CSSVars
      }
    >
      <div className="tora-full-showcase-slider__viewport">
        <div className="tora-full-showcase-slider__track">
          {displayItems.map((item, index) => {
            const isClone =
              cloneCount > 0 && (index < cloneCount || index >= cloneCount + itemCount);
            const visibleIndex = (index - cloneCount + itemCount) % itemCount;
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
