"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";

export interface ShowcasePanel {
  slug: string;
  name: string;
  background: PhotoDTO;
  cluster: PhotoDTO[];
}

// useLayoutEffect on the client (no flash when we restyle for the pinned stage),
// useEffect on the server (avoids the SSR warning).
const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// Pick a usable image URL from a photo's variants, preferring the given buckets.
function pickUrl(photo: PhotoDTO, buckets: string[]): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const b of buckets) {
    const m = webp.find((v) => v.sizeBucket === b);
    if (m) return m.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

const BG_BUCKETS = ["xlarge", "large", "medium"];
const CLUSTER_BUCKETS = ["medium", "small", "large"];

// Soft pastel tints applied to the accent (bottom) title word, matching the
// reference's color-0…3 palette. Cycled per panel.
const ACCENTS = ["#b8e6da", "#ffa6a6", "#b3d3ff", "#fff2b3"];

// Editorial display type for the giant straddling titles (reference look):
// Playfair italic ≈ the reference's Doner Display, uppercase, letter-spaced.
const TITLE_CLASS =
  "font-playfair text-[13vw] font-medium italic uppercase leading-[0.82] tracking-[0.05em] whitespace-nowrap will-change-transform sm:text-[12vw]";

// Scattered start position for a flying card (adapted from the reference's
// per-image offset tables). Cards fly in from far above/below with a tilt.
function scatter(panelIndex: number, k: number) {
  const even = panelIndex % 2 === 0;
  const ys = even ? [185, -235, 300, -135] : [-135, 300, -135, 185];
  const rots = even ? [-5, 5, 5, -5] : [5, -5, 5, -5];
  const z = even ? [3, 1, 3, 1] : [1, 3, 3, 1];
  return {
    xPercent: 0,
    yPercent: ys[k % 4],
    rotate: rots[k % 4],
    scale: 0.8,
    zIndex: z[k % 4],
  };
}

export function ScrollShowcaseClient({
  panels,
  title,
  showTitles,
}: {
  panels: ShowcasePanel[];
  title: string;
  showTitles: boolean;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);

  // Progressive enhancement: the markup is a usable vertical stack of full-screen
  // panels (no JS / reduced motion). When motion is allowed we stack the panels
  // absolutely, pin the stage, and run one scrubbed master timeline that wipes
  // each panel OVER the previous (clip-path), slides + zooms the background, flies
  // the photo cards in, and reveals the titles line by line — like the reference.
  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    const stage = stageRef.current;
    if (!root || !stage || prefersReducedMotion()) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const panelEls = gsap.utils.toArray<HTMLElement>("[data-ss-panel]");
      const n = panelEls.length;
      if (n === 0) return;

      // Stack panels on top of each other; later panels sit above earlier ones so
      // they wipe over them.
      gsap.set(stage, { height: "100svh" });
      panelEls.forEach((panel, i) => {
        gsap.set(panel, {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: i + 1,
        });
      });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: stage,
          start: "top top",
          end: "+=" + n * 120 + "%",
          pin: stage,
          scrub: 0.8,
        },
      });

      panelEls.forEach((panel, i) => {
        const container = panel.querySelector<HTMLElement>("[data-ss-container]");
        const bg = panel.querySelector<HTMLElement>("[data-ss-bg]");
        const overlay = panel.querySelector<HTMLElement>("[data-ss-overlay]");
        const imgs = gsap.utils.toArray<HTMLElement>(
          panel.querySelectorAll("[data-ss-img]"),
        );
        const lines = gsap.utils.toArray<HTMLElement>(
          panel.querySelectorAll("[data-ss-line]"),
        );

        // Initial states. Panel 0 starts revealed; the rest are clipped away to
        // the right and wipe in during their segment.
        if (i > 0) gsap.set(panel, { clipPath: "inset(0 0 0 100%)" });
        if (bg) gsap.set(bg, { scale: 1.2 });
        if (container) gsap.set(container, { xPercent: i > 0 ? 40 : 0 });
        imgs.forEach((img, k) => gsap.set(img, scatter(i, k)));
        gsap.set(lines, { yPercent: (idx: number) => (idx === 0 ? 125 : -125), opacity: 0 });

        const t = i; // each panel owns one time-unit of the scrubbed timeline

        if (i > 0) {
          tl.fromTo(
            panel,
            { clipPath: "inset(0 0 0 100%)" },
            { clipPath: "inset(0 0 0 0%)", ease: "power2.inOut", duration: 0.55 },
            t,
          );
          if (container)
            tl.fromTo(
              container,
              { xPercent: 40 },
              { xPercent: 0, ease: "power3.out", duration: 0.6 },
              t,
            );
        }
        if (bg) tl.fromTo(bg, { scale: 1.2 }, { scale: 1, duration: 0.85 }, t);
        tl.fromTo(
          lines,
          { yPercent: (idx: number) => (idx === 0 ? 125 : -125), opacity: 0 },
          { yPercent: 0, opacity: 1, ease: "power2.out", duration: 0.5, stagger: 0.06 },
          t + 0.05,
        );
        tl.to(
          imgs,
          {
            yPercent: (k: number) => (k % 2 === 0 ? -2 : 2),
            rotate: (k: number) => (k % 2 === 0 ? -2.5 : 2.5),
            scale: 1,
            ease: "power2.out",
            duration: 0.65,
            stagger: 0.06,
          },
          t + 0.05,
        );

        // Exit: as the next panel wipes over, darken + slide this one for parallax.
        if (i < n - 1) {
          if (bg)
            tl.to(bg, { filter: "brightness(0.4) blur(5px)", duration: 0.4 }, t + 0.62);
          if (overlay) tl.to(overlay, { opacity: 0.6, duration: 0.4 }, t + 0.62);
          if (container)
            tl.to(container, { xPercent: -25, ease: "power2.in", duration: 0.45 }, t + 0.6);
        }
      });

      ScrollTrigger.refresh();
    }, root);

    return () => ctx.revert();
  }, [panels]);

  return (
    <div ref={rootRef} className="relative bg-[hsl(var(--background))]">
      <div ref={stageRef} className="relative w-full overflow-hidden">
        {panels.map((p, idx) => {
          const bgUrl = pickUrl(p.background, BG_BUCKETS);
          const flip = idx % 2 === 1;
          const accent = ACCENTS[idx % ACCENTS.length];
          return (
            <article
              key={p.slug + idx}
              data-ss-panel
              className="relative h-[100svh] w-full overflow-hidden"
            >
              <div data-ss-container className="relative h-full w-full">
                {/* Background */}
                <div data-ss-bg className="absolute inset-0 will-change-transform">
                  {bgUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={bgUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/25" />
                </div>

                {/* Exit overlay (darkens as the next panel wipes over) */}
                <div
                  data-ss-overlay
                  className="pointer-events-none absolute inset-0 bg-black opacity-0"
                  aria-hidden
                />

                {/* Flying, white-matted photo cards (overlapping, slightly tilted) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {p.cluster.map((c, i) => {
                    const url = pickUrl(c, CLUSTER_BUCKETS);
                    if (!url) return null;
                    return (
                      <div
                        key={c.id + i}
                        data-ss-img
                        className="relative aspect-[4/5] w-[23vw] -mx-[2vw] shrink-0 bg-white/75 p-[0.5vw] shadow-2xl will-change-transform"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={c.altText ?? ""}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Eyebrow label (small, centered top) */}
                {title && (
                  <div className="absolute inset-x-0 top-[5vh] z-20 text-center text-[0.7rem] font-medium uppercase tracking-[0.3em] text-white/85">
                    {title}
                  </div>
                )}

                {/* Editorial title — two giant italic words straddling top & bottom,
                    alternating corners, the name tinted (reference styling). */}
                {showTitles && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between px-[4vw] py-[8vh]">
                    <div className={`overflow-hidden ${flip ? "self-end text-right" : "self-start text-left"}`}>
                      <div data-ss-line className={`${TITLE_CLASS} text-white`}>
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                    </div>
                    <div className={`overflow-hidden ${flip ? "self-start text-left" : "self-end text-right"}`}>
                      <Link href={`/categories/${p.slug}`} className="pointer-events-auto block">
                        <div data-ss-line className={TITLE_CLASS} style={{ color: accent }}>
                          {p.name}
                        </div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
