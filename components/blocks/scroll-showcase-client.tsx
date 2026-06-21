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
  "font-playfair text-[13vw] font-medium italic uppercase leading-[0.82] tracking-[0.03em] whitespace-nowrap will-change-transform sm:text-[12vw]";

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

  // Progressive enhancement: the markup below is a usable, statically-stacked
  // sequence of full-screen panels (works with no JS / reduced motion). When
  // motion is allowed we register ScrollTrigger and turn it into the pinned,
  // scroll-driven choreography (background scale → darken, images fly into a
  // cluster, titles reveal line by line). gsap.context scopes + auto-cleans.
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const panelEls = gsap.utils.toArray<HTMLElement>("[data-ss-panel]");
      panelEls.forEach((panel) => {
        const bg = panel.querySelector<HTMLElement>("[data-ss-bg]");
        const overlay = panel.querySelector<HTMLElement>("[data-ss-overlay]");
        const imgs = gsap.utils.toArray<HTMLElement>(
          panel.querySelectorAll("[data-ss-img]"),
        );
        const lines = gsap.utils.toArray<HTMLElement>(
          panel.querySelectorAll("[data-ss-line]"),
        );

        // Initial (scattered) state.
        if (bg) gsap.set(bg, { scale: 1.25 });
        imgs.forEach((img, i) => {
          const dir = i % 2 === 0 ? -1 : 1;
          gsap.set(img, {
            xPercent: dir * (45 + i * 18),
            yPercent: (i % 2 === 0 ? -1 : 1) * (130 + i * 22),
            rotate: dir * (6 + i * 1.5),
            scale: 0.72,
          });
        });
        gsap.set(lines, { yPercent: 120 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: panel,
            start: "top top",
            end: "+=150%",
            pin: true,
            pinSpacing: true,
            scrub: 0.6,
          },
        });
        if (bg) tl.to(bg, { scale: 1, ease: "none", duration: 1 }, 0);
        tl.to(
          imgs,
          {
            xPercent: 0,
            yPercent: (i: number) => (i % 2 === 0 ? -2 : 2),
            rotate: (i: number) => (i % 2 === 0 ? -2.5 : 2.5),
            scale: 1,
            ease: "power2.out",
            duration: 0.8,
            stagger: 0.06,
          },
          0,
        );
        tl.to(
          lines,
          { yPercent: 0, ease: "power3.out", duration: 0.6, stagger: 0.1 },
          0.15,
        );
        if (bg)
          tl.to(
            bg,
            { filter: "brightness(0.5) blur(4px)", ease: "none", duration: 0.5 },
            0.6,
          );
        if (overlay)
          tl.to(overlay, { opacity: 0.55, ease: "none", duration: 0.5 }, 0.7);
      });
      ScrollTrigger.refresh();
    }, root);

    return () => ctx.revert();
  }, [panels]);

  return (
    <div ref={rootRef} className="relative bg-[hsl(var(--background))]">
      {panels.map((p, idx) => {
        const bgUrl = pickUrl(p.background, BG_BUCKETS);
        // Alternate which corner the index/name occupy, like the reference.
        const flip = idx % 2 === 1;
        const accent = ACCENTS[idx % ACCENTS.length];
        return (
          <article
            key={p.slug + idx}
            data-ss-panel
            className="relative h-[100svh] w-full overflow-hidden"
          >
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

            {/* Exit overlay (darkens as the panel hands off) */}
            <div
              data-ss-overlay
              className="pointer-events-none absolute inset-0 bg-black opacity-0"
              aria-hidden
            />

            {/* Flying image cluster */}
            <div className="absolute inset-0 flex items-center justify-center gap-[2vw]">
              {p.cluster.map((c, i) => {
                const url = pickUrl(c, CLUSTER_BUCKETS);
                if (!url) return null;
                return (
                  <div
                    key={c.id + i}
                    data-ss-img
                    className="relative aspect-[4/5] w-[22vw] max-w-[260px] shrink-0 overflow-hidden rounded-sm bg-white/80 p-[0.35vw] shadow-2xl will-change-transform"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={c.altText ?? ""}
                      className="h-full w-full rounded-[1px] object-cover"
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
          </article>
        );
      })}
    </div>
  );
}
