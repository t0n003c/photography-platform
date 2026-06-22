"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { prefersReducedMotion } from "./feature";

// Lenis smooth scroll, rAF-driven. Disabled entirely under prefers-reduced-motion
// so native scrolling (and a11y) is preserved. Renders nothing.
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    // Expose the instance so components can drive the page scroll THROUGH Lenis
    // (a plain window.scrollTo gets overwritten by Lenis's rAF loop).
    (window as Window & { __lenis?: Lenis }).__lenis = lenis;
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      delete (window as Window & { __lenis?: Lenis }).__lenis;
    };
  }, []);
  return null;
}
