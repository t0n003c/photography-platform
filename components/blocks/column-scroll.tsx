"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function pickUrl(photo: PhotoDTO, buckets: string[]): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const b of buckets) {
    const m = webp.find((v) => v.sizeBucket === b);
    if (m) return m.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

const COL_BUCKETS = ["medium", "large", "small"];
const NUM_COLS = 3;

// "Alternative Scroll" — port of the Codrops "ColumnScroll" demo. A multi-column
// photo grid whose OUTER columns drift opposite to the middle one as the section
// scrolls through the viewport, with a hover squeeze/zoom. (Click→content view is
// added in a follow-up pass.) The reference drives this with Locomotive Scroll,
// which would fight our global Lenis — so we reproduce the opposite-column motion
// with a scrubbed GSAP ScrollTrigger instead. Progressive enhancement: SSR and
// prefers-reduced-motion render a plain static column grid; GSAP enhances on mount.
export function ColumnScroll({ photos, title }: { photos: PhotoDTO[]; title?: string }) {
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Round-robin the photos into columns in reading order (left→right, top→bottom),
  // matching the reference's interleave.
  const columns = React.useMemo(() => {
    const cols: PhotoDTO[][] = Array.from({ length: NUM_COLS }, () => []);
    photos.forEach((p, i) => cols[i % NUM_COLS].push(p));
    return cols;
  }, [photos]);

  useIso(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || photos.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const cols = gsap.utils.toArray<HTMLElement>("[data-cs-column]");
      const vh = window.innerHeight;
      // Drift amplitude — outer columns travel from −R→+R (down) while the middle
      // travels +R→−R (up): opposite directions, like the reference. Bounded so the
      // block's vertical slack keeps images covering, not gapping.
      const R = vh * 0.14;
      cols.forEach((col, i) => {
        const outer = i !== 1;
        gsap.fromTo(
          col,
          { y: outer ? -R : R },
          {
            y: outer ? R : -R,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
          },
        );
      });

      // Hover: squeeze the frame while the image inside zooms (reference values).
      const items = gsap.utils.toArray<HTMLElement>("[data-cs-item]");
      items.forEach((item) => {
        const outerEl = item.querySelector<HTMLElement>("[data-cs-imgwrap]");
        const innerEl = item.querySelector<HTMLElement>("[data-cs-img]");
        if (!outerEl || !innerEl) return;
        const enter = () => {
          gsap.killTweensOf([outerEl, innerEl]);
          gsap
            .timeline({ defaults: { duration: 1.4, ease: "expo" } })
            .to(outerEl, { scaleY: 0.95, scaleX: 0.88 }, 0)
            .to(innerEl, { ease: "power4", scaleY: 1.2, scaleX: 1.7 }, 0);
        };
        const leave = () => {
          gsap.killTweensOf([outerEl, innerEl]);
          gsap.timeline({ defaults: { duration: 1.4, ease: "expo" } }).to([outerEl, innerEl], { scale: 1 }, 0);
        };
        item.addEventListener("mouseenter", enter);
        item.addEventListener("mouseleave", leave);
      });
    }, root);

    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
      // Defensive: if a future content view stopped Lenis, restart it on unmount.
      (window as Window & { __lenis?: { start: () => void } }).__lenis?.start();
    };
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <div ref={rootRef} data-cs-root className="cs-root">
      {title ? <h2 className="cs-heading">{title}</h2> : null}
      <div className="cs-columns">
        {columns.map((col, ci) => (
          <div key={ci} data-cs-column data-cs-col={ci} className="cs-column">
            {col.map((photo) => {
              const url = pickUrl(photo, COL_BUCKETS);
              const caption = photo.headline || photo.altText || "";
              return (
                <figure key={photo.id} data-cs-item className="cs-item">
                  <div data-cs-imgwrap className="cs-item-imgwrap">
                    <div
                      data-cs-img
                      className="cs-item-img"
                      style={{ backgroundImage: url ? `url(${url})` : undefined }}
                    />
                  </div>
                  {caption ? <figcaption className="cs-item-cap">{caption}</figcaption> : null}
                </figure>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
