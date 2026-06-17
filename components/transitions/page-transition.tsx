"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/components/webgl/feature";

// Subtle enter transition on every navigation (App Router re-mounts template.tsx
// per route). Uses useLayoutEffect so the hidden→visible tween is set before the
// browser paints the new route (no flash). Fully skipped under reduced-motion,
// and the content is plain DOM, so no-JS / reduced-motion users see it normally.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          clearProps: "all",
        },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return <div ref={ref}>{children}</div>;
}
