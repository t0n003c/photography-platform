"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ToraModelsMasonryMotion({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const getItems = () =>
      Array.from(root.querySelectorAll<HTMLElement>(".portfolio-models-item"));
    const measure = () =>
      new Map(getItems().map((item) => [item, item.getBoundingClientRect()]));

    let lastRects = measure();
    let frame = 0;

    const cleanupItem = (item: HTMLElement) => {
      item.style.transition = "";
      item.style.transform = "";
      item.style.willChange = "";
    };

    const animateLayout = () => {
      if (reduceMotion.matches) {
        lastRects = measure();
        return;
      }

      const nextRects = measure();
      for (const item of getItems()) {
        const first = lastRects.get(item);
        const last = nextRects.get(item);
        if (!first || !last) continue;

        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

        cleanupItem(item);
        item.style.transition = "none";
        item.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        item.style.willChange = "transform";

        requestAnimationFrame(() => {
          item.style.transition = "transform 820ms cubic-bezier(.22, 1, .36, 1)";
          item.style.transform = "translate3d(0, 0, 0)";
        });

        window.setTimeout(() => cleanupItem(item), 900);
      }

      lastRects = nextRects;
    };

    const scheduleAnimation = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(animateLayout);
    };

    const observer = new ResizeObserver(scheduleAnimation);
    observer.observe(root);
    window.addEventListener("resize", scheduleAnimation);

    frame = window.requestAnimationFrame(() => {
      lastRects = measure();
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleAnimation);
      window.cancelAnimationFrame(frame);
      getItems().forEach(cleanupItem);
    };
  }, []);

  return (
    <div ref={rootRef} className="portfolio-models-masonry" aria-label="Models portfolio list">
      {children}
    </div>
  );
}
