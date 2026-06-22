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

// Pick a preview-grid column count (4–6, never fewer than 4) that fills the rows
// as evenly as possible — prefers a count that divides the photo count, then
// fewer rows. e.g. 10 → 5 (2×5), 12 → 6 (2×6), 8 → 4 (2×4).
function chooseGridCols(n: number): number {
  if (n <= 4) return 4;
  let best = 4;
  let bestScore = Infinity;
  for (let c = 4; c <= Math.min(6, n); c++) {
    const rows = Math.ceil(n / c);
    const empty = c * rows - n; // 0 = perfectly even
    const score = empty * 10 + rows; // even fill first, then fewer rows
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

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
    // Enable the 3D layout BEFORE measuring, so carousel.offsetWidth is the real
    // card width (not the flat-grid fallback's full-container width).
    root.classList.add("is-enhanced");

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
        // Distribute the cells around the ring. Set the transform as a CSS string
        // so the order is rotateY()-THEN-translateZ() — a true ring with faces
        // pointing OUTWARD. (gsap.set applies translate before rotate, which
        // stacks every cell at the center like a fanned deck sharing edges.)
        cells.forEach((cell, i) => {
          cell.style.transform = `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`;
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
          // Typewriter reveal (matching the reference): each char snaps in
          // (autoAlpha 0->1, ~instant) staggered left-to-right — clearly a
          // per-character type effect, not a fade. One-shot so it always
          // completes and never freezes mid-typed.
          const tReveal = gsap.from(split.chars, {
            autoAlpha: 0,
            yPercent: 18,
            // Each char eases in (smooth) instead of snapping; the 0.12 stagger
            // keeps the typewriter cadence.
            duration: 0.28,
            ease: "power2.out",
            stagger: { each: 0.12, from: "start" },
            scrollTrigger: { trigger: scene, start: "top 70%", toggleActions: "play none none reverse" },
          });
          if (tReveal.scrollTrigger) st.triggers.push(tReveal.scrollTrigger);
        }
        // Preview-grid title: split into chars now and hide them, so it can type
        // out when the preview opens.
        const pTitleSpan = scene.querySelector<HTMLElement>("[data-c3d-preview-title-span]");
        if (pTitleSpan) {
          const pSplit = new SplitText(pTitleSpan, { type: "chars", charsClass: "c3d-char" });
          gsap.set(pSplit.chars, { autoAlpha: 0 });
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

    st.enhanced = true;

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
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
    preview.scrollTop = 0; // always start the grid at the top
    const targetY = window.scrollY + scene.getBoundingClientRect().top;
    // Reset any leftover transforms, then measure so items open FROM THE MIDDLE
    // OUT: each starts at the grid centre, angled to FACE INWARD toward each
    // other (like the reference), then flies to its slot rotating flat.
    gsap.set(gridItems, { clearProps: "all" });
    // Faithful replication of the reference reveal: each item flies forward from
    // deep z (-3500) and SWINGS into place — rotationY ±100° around an origin
    // pushed BEHIND it by |dx|·0.8px (so it arcs like a hinge, not a flat spin) —
    // rising from a half-pull in y toward the viewport centre. Items keep their
    // grid X. Per-item distance-based stagger (edges first on open).
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const data = Array.from(gridItems).map((el) => {
      const r = el.getBoundingClientRect();
      const ecx = r.left + r.width / 2;
      const ecy = r.top + r.height / 2;
      return { el, dx: cx - ecx, dy: cy - ecy, dist: Math.hypot(cx - ecx, cy - ecy), isLeft: ecx < cx };
    });
    const maxDist = Math.max(...data.map((d) => d.dist), 1);
    const totalStagger = 0.025 * (data.length - 1);

    const tl = gsap.timeline({
      onComplete: () => {
        st.isAnimating = false;
        st.openIndex = i;
      },
    });
    tl.to(window, { duration: 0.7, scrollTo: { y: targetY, autoKill: false }, ease: "power2.inOut" }, 0)
      .to(carousel, { duration: 1.3, rotationX: 90, rotationY: -360, z: -2000, ease: "power2.inOut" }, 0)
      .fromTo(preview, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.8);

    // The category name types out as the grid appears.
    tl.fromTo(
      preview.querySelectorAll<HTMLElement>(".c3d-preview-title .c3d-char"),
      { autoAlpha: 0, yPercent: 20 },
      { autoAlpha: 1, yPercent: 0, duration: 0.3, ease: "power2.out", stagger: { each: 0.08, from: "start" } },
      0.95,
    );

    const base = 0.95;
    data.forEach(({ el, dx, dy, dist, isLeft }) => {
      const delay = (1 - dist / maxDist) * totalStagger; // 'in': edges first
      const rotationY = isLeft ? 100 : -100;
      tl.fromTo(
        el,
        { transformOrigin: `50% 50% ${-Math.abs(dx) * 0.8}px`, autoAlpha: 0, y: dy * 0.5, scale: 0.5, rotationY },
        { y: 0, scale: 1, rotationY: 0, autoAlpha: 1, duration: 0.45, ease: "sine" },
        base + delay + 0.1,
      );
      tl.fromTo(el, { z: -3500 }, { z: 0, duration: 0.35, ease: "expo" }, base + delay);
    });
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
    // Reverse of the reference reveal: each item swings back (rotationY ±100°
    // around the pushed-back origin), drops a half-y toward the centre, shrinks +
    // fades, then recedes into deep z. Per-item stagger (centre first on close).
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const data = Array.from(gridItems).map((el) => {
      const r = el.getBoundingClientRect();
      const ecx = r.left + r.width / 2;
      const ecy = r.top + r.height / 2;
      return { el, dx: cx - ecx, dy: cy - ecy, dist: Math.hypot(cx - ecx, cy - ecy), isLeft: ecx < cx };
    });
    const maxDist = Math.max(...data.map((d) => d.dist), 1);
    const totalStagger = 0.025 * (data.length - 1);

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(gridItems, { clearProps: "all" });
        gsap.set(preview.querySelectorAll(".c3d-preview-title .c3d-char"), { autoAlpha: 0, yPercent: 0 });
        preview.classList.remove("is-open");
        st.triggers.forEach((t) => t.enable());
        ScrollTrigger.refresh();
        document.body.style.overflow = "";
        st.isAnimating = false;
        st.openIndex = null;
      },
    });
    data.forEach(({ el, dx, dy, dist, isLeft }) => {
      const delay = (dist / maxDist) * totalStagger; // 'out': centre first
      const rotationY = isLeft ? 100 : -100;
      tl.to(
        el,
        {
          startAt: { transformOrigin: `50% 50% ${-Math.abs(dx) * 0.8}px` },
          y: dy * 0.4,
          rotationY,
          scale: 0.4,
          autoAlpha: 0,
          duration: 0.4,
          ease: "sine.in",
        },
        delay,
      );
      tl.to(el, { z: -3500, duration: 0.4, ease: "expo.in" }, delay + 0.7);
    });
    // Un-type the preview category name as we exit (chars vanish from the end).
    tl.to(
      preview.querySelectorAll<HTMLElement>(".c3d-preview-title .c3d-char"),
      { autoAlpha: 0, yPercent: 20, duration: 0.25, ease: "power2.in", stagger: { each: 0.07, from: "end" } },
      0,
    );
    tl.to(preview, { opacity: 0, duration: 0.4 }, totalStagger + 1.0).to(
      carousel,
      { rotationX: 0, rotationY: 0, z: Number(carousel.dataset.restZ) || -550, duration: 1.0, ease: "power2.inOut" },
      totalStagger + 1.0,
    );
    // Re-type the scene's overlay title as the carousel returns into view.
    tl.fromTo(
      scene.querySelectorAll<HTMLElement>("[data-c3d-title-span] .c3d-char"),
      { autoAlpha: 0, yPercent: 18 },
      { autoAlpha: 1, yPercent: 0, duration: 0.28, ease: "power2.out", stagger: { each: 0.12, from: "start" } },
      totalStagger + 1.15,
    );
  };

  return (
    <div ref={rootRef} className="c3d-root relative bg-[hsl(var(--background))]">
      {scenes.map((scene, si) => {
        const cells = scene.photos.slice(0, MAX_CELLS);
        const href = scene.kind === "category" ? `/categories/${scene.slug}` : `/locations/${scene.slug}`;
        const cols = chooseGridCols(scene.photos.length);
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
            <div
              data-c3d-preview
              data-lenis-prevent
              className="c3d-preview"
              style={{ ["--c3d-cols" as string]: cols }}
            >
              <header className="c3d-preview-header">
                <h3 className="c3d-preview-title">
                  <span data-c3d-preview-title-span>{scene.name}</span>
                </h3>
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
