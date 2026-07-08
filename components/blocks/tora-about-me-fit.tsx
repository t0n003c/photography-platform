"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ToraAboutMeFit({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const image = root.querySelector<HTMLElement>(".tora-about-me-author-image");
    if (!image) return;

    const desktopQuery = window.matchMedia("(min-width: 992px)");
    let frame = 0;

    const syncHeight = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (!desktopQuery.matches) {
          root.style.removeProperty("--tora-about-me-content-height");
          return;
        }
        const height = image.getBoundingClientRect().height;
        if (height > 0) {
          root.style.setProperty("--tora-about-me-content-height", `${Math.round(height)}px`);
        }
      });
    };

    const observer = new ResizeObserver(syncHeight);
    observer.observe(root);
    observer.observe(image);
    desktopQuery.addEventListener("change", syncHeight);
    window.addEventListener("resize", syncHeight);
    syncHeight();

    return () => {
      observer.disconnect();
      desktopQuery.removeEventListener("change", syncHeight);
      window.removeEventListener("resize", syncHeight);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="about-section-tora-about-me">
      {children}
    </div>
  );
}
