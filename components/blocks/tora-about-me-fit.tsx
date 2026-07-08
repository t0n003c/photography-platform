"use client";

import { useEffect, useRef, type ReactNode } from "react";

type LenisHandle = { stop: () => void; start: () => void };

export function ToraAboutMeFit({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const image = root.querySelector<HTMLElement>(".tora-about-me-author-image");
    const content = root.querySelector<HTMLElement>(".content-wrap");
    if (!image) return;

    const desktopQuery = window.matchMedia("(min-width: 992px)");
    let frame = 0;
    let lenisStopped = false;

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

    const canContainScroll = () =>
      desktopQuery.matches &&
      content &&
      content.scrollHeight > content.clientHeight + 1;

    const getLenis = () => (window as Window & { __lenis?: LenisHandle }).__lenis;

    const stopPageScroll = () => {
      if (!canContainScroll() || lenisStopped) return;
      getLenis()?.stop();
      lenisStopped = true;
    };

    const resumePageScroll = () => {
      if (!lenisStopped) return;
      getLenis()?.start();
      lenisStopped = false;
    };

    const containWheel = (event: WheelEvent) => {
      if (!canContainScroll() || !content) return;
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      stopPageScroll();

      const maxScroll = content.scrollHeight - content.clientHeight;
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? event.deltaY * content.clientHeight
            : event.deltaY;
      const nextScroll = Math.max(0, Math.min(maxScroll, content.scrollTop + delta));

      event.preventDefault();
      event.stopPropagation();
      content.scrollTop = nextScroll;
    };

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        if (!document.activeElement || !root.contains(document.activeElement)) {
          resumePageScroll();
        }
      });
    };

    const handleDesktopChange = () => {
      syncHeight();
      if (!desktopQuery.matches) resumePageScroll();
    };

    root.addEventListener("pointerenter", stopPageScroll);
    root.addEventListener("pointerleave", resumePageScroll);
    root.addEventListener("focusin", stopPageScroll);
    root.addEventListener("focusout", handleFocusOut);
    root.addEventListener("wheel", containWheel, { capture: true, passive: false });
    desktopQuery.addEventListener("change", handleDesktopChange);
    window.addEventListener("resize", syncHeight);
    window.addEventListener("blur", resumePageScroll);
    syncHeight();

    return () => {
      observer.disconnect();
      resumePageScroll();
      root.removeEventListener("pointerenter", stopPageScroll);
      root.removeEventListener("pointerleave", resumePageScroll);
      root.removeEventListener("focusin", stopPageScroll);
      root.removeEventListener("focusout", handleFocusOut);
      root.removeEventListener("wheel", containWheel, true);
      desktopQuery.removeEventListener("change", handleDesktopChange);
      window.removeEventListener("resize", syncHeight);
      window.removeEventListener("blur", resumePageScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={rootRef} className="about-section-tora-about-me">
      {children}
    </div>
  );
}
