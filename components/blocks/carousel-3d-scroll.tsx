"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { SplitText } from "gsap/SplitText";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";

export interface CarouselScene {
  slug: string;
  name: string;
  kind: "category" | "location";
  photos: PhotoDTO[];
}

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function pickUrl(photo: PhotoDTO, buckets: string[]): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const b of buckets) {
    const m = webp.find((v) => v.sizeBucket === b);
    if (m) return m.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

const RING_BUCKETS = ["medium", "large", "small"];
const GRID_BUCKETS = ["medium", "small", "large"];
// Fewer cards on a bigger ring => they float spread-out with gaps, like the
// reference (which uses ~4–6 cards). More cards would tile into a solid drum.
const MAX_CELLS = 6;

// On-scroll 3D carousel (adapted from the Codrops "On-Scroll 3D Carousel"). Each
// scene holds a ring of cards that rotates as it scrolls through the viewport;
// clicking the title flies the ring away and opens a full-screen preview grid of
// that collection's photos. Progressive enhancement: SSR / reduced-motion render
// a plain photo grid; GSAP turns it into the 3D effect on mount.
export function Carousel3DScroll({ scenes }: { scenes: CarouselScene[] }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  // Imperative state shared between the setup effect and the click handlers.
  const stateRef = React.useRef<{
    enhanced: boolean;
    isAnimating: boolean;
    openIndex: number | null;
    triggers: ScrollTrigger[];
  }>({ enhanced: false, isAnimating: false, openIndex: null, triggers: [] });

  useIso(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;

    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, SplitText);
    const st = stateRef.current;
    st.triggers = [];

    const ctx = gsap.context(() => {
      const sceneEls = gsap.utils.toArray<HTMLElement>("[data-c3d-scene]");
      sceneEls.forEach((scene, si) => {
        const carousel = scene.querySelector<HTMLElement>("[data-c3d-carousel]");
        const cells = gsap.utils.toArray<HTMLElement>(scene.querySelectorAll("[data-c3d-cell]"));
        const titleSpan = scene.querySelector<HTMLElement>("[data-c3d-title-span]");
        const titleEl = scene.querySelector<HTMLElement>("[data-c3d-title]");
        if (!carousel || cells.length === 0) return;

        // Position the cells in a ring. Radius scales with card width (≈ the
        // reference's radius/card ratio) so cards spread out with gaps rather
        // than tiling edge-to-edge. Floor at the no-overlap minimum for safety.
        const n = cells.length;
        const cardW = carousel.offsetWidth || 340;
        const minRadius = n > 1 ? cardW / 2 / Math.tan(Math.PI / n) : 0;
        const radius = Math.round(Math.max(cardW * 1.5, minRadius + 30));
        cells.forEach((cell, i) => {
          gsap.set(cell, { rotateY: (360 / n) * i, z: radius });
        });
        const startY = si % 2 === 1 ? 45 : 0; // alternate, like the reference
        // Push the ring back so the FRONT card sits ~40px deep (prominent) no
        // matter the radius — bigger ring spreads the cards wider in view.
        const restZ = -(radius + 40);
        carousel.dataset.restZ = String(restZ);
        gsap.set(carousel, { z: restZ, rotateY: startY, transformOrigin: "50% 50%" });

        // Scroll-driven rotation of the ring + subtle wobble.
        const spin = gsap.timeline({
          defaults: { ease: "sine.inOut" },
          scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true },
        });
        spin.fromTo(carousel, { rotationY: startY }, { rotationY: startY - 180 }, 0);
        spin.fromTo(carousel, { rotationZ: 3, rotationX: 3 }, { rotationZ: -3, rotationX: -3 }, 0);
        if (spin.scrollTrigger) st.triggers.push(spin.scrollTrigger);

        // Title: SplitText char reveal (scrubbed) + parallax drift.
        if (titleSpan) {
          const split = new SplitText(titleSpan, { type: "chars", charsClass: "c3d-char" });
          const tReveal = gsap.from(split.chars, {
            yPercent: 120,
            opacity: 0,
            stagger: 0.03,
            ease: "power3.out",
            scrollTrigger: { trigger: scene, start: "top 85%", end: "top 35%", scrub: true },
          });
          if (tReveal.scrollTrigger) st.triggers.push(tReveal.scrollTrigger);
        }
        if (titleEl) {
          const tPar = gsap.to(titleEl, {
            yPercent: -30,
            ease: "none",
            scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true },
          });
          if (tPar.scrollTrigger) st.triggers.push(tPar.scrollTrigger);
        }
      });

      ScrollTrigger.refresh();
    }, root);

    root.classList.add("is-enhanced");
    st.enhanced = true;

    return () => {
      ctx.revert();
      st.enhanced = false;
      st.triggers = [];
      document.body.style.overflow = "";
    };
  }, [scenes]);

  const openPreview = (i: number) => {
    const root = rootRef.current;
    const st = stateRef.current;
    if (!root || !st.enhanced || st.isAnimating || st.openIndex !== null) return;
    const scene = root.querySelectorAll<HTMLElement>("[data-c3d-scene]")[i];
    const carousel = scene?.querySelector<HTMLElement>("[data-c3d-carousel]");
    const preview = scene?.querySelector<HTMLElement>("[data-c3d-preview]");
    if (!scene || !carousel || !preview) return;

    st.isAnimating = true;
    const gridItems = preview.querySelectorAll<HTMLElement>("[data-c3d-grid-item]");
    st.triggers.forEach((t) => t.disable(false));
    document.body.style.overflow = "hidden";
    preview.classList.add("is-open");
    const targetY = window.scrollY + scene.getBoundingClientRect().top;

    gsap
      .timeline({
        onComplete: () => {
          st.isAnimating = false;
          st.openIndex = i;
        },
      })
      .to(window, { duration: 0.7, scrollTo: { y: targetY, autoKill: false }, ease: "power2.inOut" }, 0)
      .to(carousel, { duration: 1.3, rotationX: 90, rotationY: -360, z: -2000, ease: "power2.inOut" }, 0)
      .fromTo(preview, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.85)
      .fromTo(
        gridItems,
        { yPercent: 25, autoAlpha: 0, clipPath: "inset(100% 0 0 0)" },
        { yPercent: 0, autoAlpha: 1, clipPath: "inset(0% 0 0 0)", stagger: 0.05, duration: 0.6, ease: "power3.out" },
        0.95,
      );
  };

  const closePreview = (i: number) => {
    const root = rootRef.current;
    const st = stateRef.current;
    if (!root || st.isAnimating) return;
    const scene = root.querySelectorAll<HTMLElement>("[data-c3d-scene]")[i];
    const carousel = scene?.querySelector<HTMLElement>("[data-c3d-carousel]");
    const preview = scene?.querySelector<HTMLElement>("[data-c3d-preview]");
    if (!scene || !carousel || !preview) return;

    st.isAnimating = true;
    const gridItems = preview.querySelectorAll<HTMLElement>("[data-c3d-grid-item]");
    gsap
      .timeline({
        onComplete: () => {
          preview.classList.remove("is-open");
          st.triggers.forEach((t) => t.enable());
          ScrollTrigger.refresh();
          document.body.style.overflow = "";
          st.isAnimating = false;
          st.openIndex = null;
        },
      })
      .to(gridItems, { yPercent: 25, autoAlpha: 0, clipPath: "inset(100% 0 0 0)", stagger: 0.03, duration: 0.4 }, 0)
      .to(preview, { opacity: 0, duration: 0.4 }, 0.2)
      .to(
        carousel,
        { rotationX: 0, rotationY: 0, z: Number(carousel.dataset.restZ) || -550, duration: 1.0, ease: "power2.inOut" },
        0.2,
      );
  };

  return (
    <div ref={rootRef} className="c3d-root relative bg-[hsl(var(--background))]">
      {scenes.map((scene, si) => {
        const cells = scene.photos.slice(0, MAX_CELLS);
        const href = scene.kind === "category" ? `/categories/${scene.slug}` : `/locations/${scene.slug}`;
        const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(scene.photos.length))));
        return (
          <section key={scene.slug + si} data-c3d-scene className="c3d-scene">
            <h2 data-c3d-title className="c3d-title">
              <a
                href={href}
                className="c3d-title-link"
                onClick={(e) => {
                  if (stateRef.current.enhanced) {
                    e.preventDefault();
                    openPreview(si);
                  }
                }}
              >
                <span data-c3d-title-span className="c3d-title-span">
                  {scene.name}
                </span>
              </a>
            </h2>

            <div className="c3d-stage">
              <div data-c3d-carousel className="c3d-carousel">
                {cells.map((photo, ci) => {
                  const url = pickUrl(photo, RING_BUCKETS);
                  return (
                    <div key={photo.id + ci} data-c3d-cell className="c3d-cell">
                      <div className="c3d-card">
                        <div className="c3d-face front" style={{ backgroundImage: url ? `url(${url})` : undefined }} />
                        <div className="c3d-face back" style={{ backgroundImage: url ? `url(${url})` : undefined }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Full-screen preview grid (faithful reference transition target) */}
            <div data-c3d-preview className="c3d-preview" style={{ ["--c3d-cols" as string]: cols }}>
              <header className="c3d-preview-header">
                <h3 className="c3d-preview-title">{scene.name}</h3>
                <button type="button" className="c3d-close" onClick={() => closePreview(si)}>
                  Close ✕
                </button>
              </header>
              <div className="c3d-grid">
                {scene.photos.map((photo, gi) => {
                  const url = pickUrl(photo, GRID_BUCKETS);
                  const caption = photo.headline || photo.altText || "";
                  return (
                    <figure key={photo.id + gi} data-c3d-grid-item className="c3d-grid-item">
                      <div className="c3d-grid-img" style={{ backgroundImage: url ? `url(${url})` : undefined }} />
                      {caption && <figcaption className="c3d-grid-cap">{caption}</figcaption>}
                    </figure>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
