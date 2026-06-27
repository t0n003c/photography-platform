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
      const mobileSpin = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
      const spinArc = mobileSpin ? 180 : 90;
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
        carousel.dataset.ringRadius = String(radius);
        // Spin the ring through a symmetric sweep so that at the scene's
        // CENTRE (scroll progress 0.5, where sine.inOut == 0.5) the rotation lands
        // on 0° — a front-facing card. Mobile uses a wider ±180° sweep so each
        // scene completes a full turn while passing through the viewport.
        // Alternate scenes spin the opposite way for visual variety; both pass
        // through front-facing when centred on screen.
        const spinFrom = si % 2 === 1 ? -spinArc : spinArc;
        const spinTo = -spinFrom;
        carousel.dataset.spinFrom = String(spinFrom);
        carousel.dataset.spinTo = String(spinTo);
        // Push the ring back so the FRONT card sits ~40px deep (prominent) no
        // matter the radius — bigger ring spreads the cards wider in view.
        const restZ = -(radius + 40);
        carousel.dataset.restZ = String(restZ);
        gsap.set(carousel, { z: restZ, rotateY: spinFrom, transformOrigin: "50% 50%" });

        // Scroll-driven rotation of the ring + subtle wobble.
        const spin = gsap.timeline({
          defaults: { ease: "sine.inOut" },
          scrollTrigger: { trigger: scene, start: "top bottom", end: "bottom top", scrub: true },
        });
        spin.fromTo(carousel, { rotationY: spinFrom }, { rotationY: spinTo }, 0);
        spin.fromTo(carousel, { rotationZ: 3, rotationX: 3 }, { rotationZ: -3, rotationX: -3 }, 0);
        if (spin.scrollTrigger) {
          st.triggers.push(spin.scrollTrigger);
          // Keep a direct handle to the spin's ScrollTrigger so openPreview can use
          // its EXACT start/end (not a hand-rolled scrollStart/range that drifts
          // from ScrollTrigger's real values via svh-vs-vh / rounding).
          (carousel as HTMLElement & { __spinST?: { start: number; end: number } }).__spinST =
            spin.scrollTrigger as unknown as { start: number; end: number };
        }

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
        // Preview-grid header (title + close): split into chars now and hide them,
        // so they can type out when the preview opens.
        scene
          .querySelectorAll<HTMLElement>("[data-c3d-preview-title-span], [data-c3d-close-span]")
          .forEach((span) => {
            const s = new SplitText(span, { type: "chars", charsClass: "c3d-char" });
            gsap.set(s.chars, { autoAlpha: 0 });
          });
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
      st.isAnimating = false;
      st.openIndex = null;
      st.triggers = [];
      document.body.style.overflow = "";
      // If we unmount while a preview is open, Lenis was stopped — restart it so the
      // next page isn't left with its scroll locked.
      (window as Window & { __lenis?: { start: () => void } }).__lenis?.start();
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
    // Lock the page via Lenis (not overflow:hidden, which would shrink the
    // scrollable height and clamp our scrollTo). scrollTo(force) overrides the lock.
    const lenis = (window as Window & { __lenis?: { stop: () => void } }).__lenis;
    if (lenis) lenis.stop();
    else document.body.style.overflow = "hidden";
    preview.classList.add("is-open");
    preview.scrollTop = 0; // always start the grid at the top
    // Adjust the underlying scroll DURING the transition (while the carousel is
    // flown away + the preview covers the screen) so that on return the clicked
    // scene sits CENTRED on screen — which, with the symmetric ±90° sweep, is
    // exactly where a card faces front (rotationY 0, no wobble). This also resolves
    // "screen centre between two categories": whichever category is clicked is the
    // one re-centred on return, no visible snap.
    const vh = window.innerHeight;
    // Use the spin ScrollTrigger's EXACT scroll range so targetScroll maps to the
    // scene centre through the same math the scrub uses. Fall back to a hand measure
    // only if the handle is missing.
    const spinST = (carousel as HTMLElement & { __spinST?: { start: number; end: number } }).__spinST;
    const tStart = spinST ? spinST.start : window.scrollY + scene.getBoundingClientRect().top - vh;
    const tEnd = spinST ? spinST.end : tStart + scene.offsetHeight + vh;
    const tRange = tEnd - tStart || 1;
    // Scene centred = scroll progress 0.5. At 0.5 the spin's sine.inOut ease == 0.5,
    // so rotationY lands on 0 (front-facing) and the ±3° wobble (3 − 6·0.5) is 0.
    carousel.dataset.frontRotation = "0";
    carousel.dataset.frontWobble = "0";
    // The title parallax (yPercent: 0 → −30, linear in scroll) rests at −15 at the
    // centre; record it so the close can pre-place the title and the re-enabled
    // scrub doesn't nudge it.
    carousel.dataset.frontTitleY = String(-30 * 0.5);
    const targetScroll = tStart + 0.5 * tRange;
    carousel.dataset.frontScroll = String(targetScroll);
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
    // Un-type the scene title up front (reference fades the chars from the end) so
    // it doesn't sit static while the ring flies; it re-types on close.
    tl.to(
      scene.querySelectorAll<HTMLElement>("[data-c3d-title-span] .c3d-char"),
      { autoAlpha: 0, duration: 0.12, ease: "none", stagger: { each: 0.04, from: "end" } },
      0,
    );
    // Smoothly glide the page to the centred scroll WHILE the ring spins — like the
    // reference, which scrolls to target over ~1.5s at the very start. The carousel
    // (centred in its scene) eases to viewport centre as it spins: a seamless
    // adjustment, never a snap. Driven through Lenis each frame (force overrides the
    // lock); GSAP owns the easing so it stays inside this timeline.
    const scrollProxy = { y: window.scrollY };
    tl.to(
      scrollProxy,
      {
        y: targetScroll,
        duration: 1.3,
        ease: "power2.inOut",
        onUpdate: () => {
          const lenis = (window as Window & { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
          if (lenis) lenis.scrollTo(scrollProxy.y, { immediate: true, force: true });
          else window.scrollTo(0, scrollProxy.y);
        },
      },
      0,
    );
    // Faithful to the reference open: (1) the ring spins and recedes into depth,
    // then (2) RUSHES TOWARD THE VIEWER — z drives past the camera while it spins
    // in-plane (rotationZ), so the cards blow up and fly past you right before the
    // grid takes over. (Reference: z −2000 then z 1500 / rotationZ 270.)
    tl.to(carousel, { duration: 1.5, rotationX: 90, rotationY: -360, z: -2000, ease: "power2.inOut" }, 0)
      .to(carousel, { duration: 2.5, ease: "power3.inOut", z: 1500, rotationZ: 270 }, 0.7);

    // The preview background covers the screen just as the ring blows past the
    // camera. autoAlpha (not plain opacity) so it RESTORES visibility — the close
    // hides it with autoAlpha, and an opacity-only reveal would leave it
    // visibility:hidden and show nothing.
    const base = 2.6; // grid reveal start (reference reveals at ≈2.6s)
    tl.fromTo(preview, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: "power1.out" }, base - 0.3);

    // The category name types out as the grid appears.
    tl.fromTo(
      preview.querySelectorAll<HTMLElement>(".c3d-preview-header .c3d-char"),
      { autoAlpha: 0, yPercent: 20 },
      { autoAlpha: 1, yPercent: 0, duration: 0.3, ease: "power2.out", stagger: { each: 0.08, from: "start" } },
      base,
    );
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
    const cards = scene.querySelectorAll<HTMLElement>(".c3d-card");
    const titleEl = scene.querySelector<HTMLElement>("[data-c3d-title]");
    const restZ = Number(carousel.dataset.restZ) || -550;
    const frontRotation = Number(carousel.dataset.frontRotation) || 0;
    const frontWobble = Number(carousel.dataset.frontWobble) || 0;

    // Reduced exit, matching the reference (deactivatePreviewToCarousel): no per-item
    // grid fly-out — the preview simply fades while the ring RISES FROM BELOW
    // (yPercent 300 → 0) spinning back two turns to its centred, front-facing rest.
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(gridItems, { clearProps: "all" });
        gsap.set(preview.querySelectorAll(".c3d-preview-header .c3d-char"), { autoAlpha: 0, yPercent: 0 });
        preview.classList.remove("is-open");
        // Unlock Lenis (or restore overflow fallback), re-enable the scrub, then
        // pin the page at the front-facing scroll BEFORE syncing the scrub — the
        // scrub derives rotation from window.scrollY, so this is what actually
        // decides the resting rotation.
        const lenis = (
          window as Window & {
            __lenis?: { start: () => void; scrollTo: (t: number, o?: object) => void };
          }
        ).__lenis;
        if (lenis) lenis.start();
        else document.body.style.overflow = "";
        st.triggers.forEach((t) => t.enable());
        ScrollTrigger.refresh();
        const target = Number(carousel.dataset.frontScroll);
        if (!Number.isNaN(target)) {
          if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
          else window.scrollTo(0, target);
          ScrollTrigger.update();
        }
        st.isAnimating = false;
        st.openIndex = null;
      },
    });
    // Pre-place the title container at the parallax value the scrub will rest at
    // (centre → −15), while it's still hidden, so the re-typed title doesn't shift.
    if (titleEl) tl.set(titleEl, { yPercent: Number(carousel.dataset.frontTitleY) || 0 }, 0);
    // Fade the whole preview (grid included) out.
    tl.to(preview, { autoAlpha: 0, duration: 0.5, ease: "power2.in" }, 0);
    // Ring rises from below + spins back to the centred front-facing rest. Ends on
    // the exact state the scrub holds (rotationY frontRotation, rotationX/Z wobble,
    // z restZ) so the hand-off is seamless.
    tl.fromTo(
      carousel,
      { z: restZ, rotationX: frontWobble, rotationY: frontRotation - 720, rotationZ: frontWobble, yPercent: 300 },
      { rotationY: frontRotation, yPercent: 0, duration: 1.3, ease: "expo" },
      0,
    );
    // Cards fade in as the ring rises (reference fades cards at 0.3).
    tl.fromTo(cards, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: "power1.out" }, 0.3);
    // Re-type the scene's overlay title (quick, like the reference's char fade-in).
    tl.fromTo(
      scene.querySelectorAll<HTMLElement>("[data-c3d-title-span] .c3d-char"),
      { autoAlpha: 0, yPercent: 14 },
      { autoAlpha: 1, yPercent: 0, duration: 0.18, ease: "power2.out", stagger: { each: 0.045, from: "start" } },
      0.35,
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
              <div className="c3d-preview-inner">
                <header className="c3d-preview-header">
                <h3 className="c3d-preview-title">
                  <span data-c3d-preview-title-span>{scene.name}</span>
                </h3>
                <button type="button" className="c3d-close" onClick={() => closePreview(si)}>
                  <span data-c3d-close-span>Close ✕</span>
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
            </div>
          </section>
        );
      })}
    </div>
  );
}
