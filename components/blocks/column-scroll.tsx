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
const FOCUS_BUCKETS = ["large", "medium", "small"];
const NUM_COLS = 3;

type Lenis = { stop: () => void; start: () => void };
function lenis(): Lenis | undefined {
  return (window as Window & { __lenis?: Lenis }).__lenis;
}

// "Alternative Scroll" — port of the Codrops "ColumnScroll" demo. A multi-column
// photo grid whose OUTER columns drift opposite to the middle one as the section
// scrolls through the viewport (hover squeeze/zoom), and a click→full-screen
// "content view": the image scales up to centre, the other in-view photos fly to a
// thumbnail nav, an optional split heading parts, and the photo's title/caption
// reveal; Back (or Esc) reverses it; nav thumbs switch the focused photo.
//
// The reference drives the columns with Locomotive Scroll, which would fight our
// global Lenis — so we reproduce the opposite-column motion with a scrubbed GSAP
// ScrollTrigger. Because our columns use overflow:hidden for the drift, the content
// view animates fixed-position OVERLAY clones (not the clipped real items) — same
// visual, robust. Progressive enhancement: SSR / reduced-motion render a plain
// static column grid; GSAP enhances on mount.
export function ColumnScroll({ photos, title }: { photos: PhotoDTO[]; title?: string }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const focusRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);
  const metaRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);

  const state = React.useRef<{
    enhanced: boolean;
    isAnimating: boolean;
    open: boolean;
    scrub: ScrollTrigger[];
    inView: Set<number>;
  }>({ enhanced: false, isAnimating: false, open: false, scrub: [], inView: new Set() });

  // The focused photo + the sibling thumbnails currently shown in the content view.
  const [content, setContent] = React.useState<{ index: number; thumbs: number[] } | null>(null);

  // Responsive column count: 3 desktop / 2 tablet / 1 phone (SSR defaults to 3).
  const [numCols, setNumCols] = React.useState(NUM_COLS);
  React.useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setNumCols(w <= 480 ? 1 : w <= 768 ? 2 : 3);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const columns = React.useMemo(() => {
    const cols: { photo: PhotoDTO; index: number }[][] = Array.from({ length: numCols }, () => []);
    photos.forEach((p, i) => cols[i % numCols].push({ photo: p, index: i }));
    return cols;
  }, [photos, numCols]);

  // ── Enhance: opposite-column scrub + hover + in-view tracking ──────────────
  useIso(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || photos.length === 0) return;

    gsap.registerPlugin(ScrollTrigger);
    const st = state.current;
    st.scrub = [];
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const cols = gsap.utils.toArray<HTMLElement>("[data-cs-column]");
      const vh = window.innerHeight;
      const R = vh * 0.14; // drift amplitude; even cols −R→+R (down), odd cols +R→−R (up)
      // Opposite-direction drift only makes sense with ≥2 columns (1-col phone = plain scroll).
      if (cols.length > 1) {
        cols.forEach((col, i) => {
          const even = i % 2 === 0;
          const tween = gsap.fromTo(
            col,
            { y: even ? -R : R },
            {
              y: even ? R : -R,
              ease: "none",
              scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: true },
            },
          );
          if (tween.scrollTrigger) st.scrub.push(tween.scrollTrigger);
        });
      }

      const items = gsap.utils.toArray<HTMLElement>("[data-cs-item]");
      items.forEach((item) => {
        const outerEl = item.querySelector<HTMLElement>("[data-cs-imgwrap]");
        const innerEl = item.querySelector<HTMLElement>("[data-cs-img]");
        if (!outerEl || !innerEl) return;
        const enter = () => {
          if (st.open) return;
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

    // Track which items are in the viewport (only those become thumbnails).
    st.inView = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const idx = Number((e.target as HTMLElement).dataset.csIndex);
        if (e.isIntersecting) st.inView.add(idx);
        else st.inView.delete(idx);
      });
    });
    root.querySelectorAll<HTMLElement>("[data-cs-item]").forEach((el) => io.observe(el));

    st.enhanced = true;
    ScrollTrigger.refresh();

    return () => {
      io.disconnect();
      ctx.revert();
      root.classList.remove("is-enhanced");
      st.enhanced = false;
      st.open = false;
      st.isAnimating = false;
      st.scrub = [];
      lenis()?.start(); // never leave the next page scroll-locked
    };
  }, [photos, numCols]);

  // Geometry helper: the centred target box for the focused image (≈70vh tall).
  const focusTarget = React.useCallback((photo: PhotoDTO) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ar = photo.width && photo.height ? photo.width / photo.height : 0.8;
    let h = vh * 0.7;
    let w = h * ar;
    const maxW = vw * 0.9;
    if (w > maxW) {
      w = maxW;
      h = w / ar;
    }
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }, []);

  // ── Open the content view from a clicked item ──────────────────────────────
  const openContent = React.useCallback(
    (index: number, originEl: HTMLElement) => {
      const st = state.current;
      if (!st.enhanced || st.isAnimating || st.open) return;
      st.isAnimating = true;
      st.open = true;
      const origin = originEl.getBoundingClientRect();
      // Siblings: in-view items minus the clicked one (capped for a tidy nav row).
      const thumbs = [...st.inView].filter((i) => i !== index).slice(0, 6);
      // Stash origin rects for fly-from-grid + fly-back-to-grid.
      const originRects = new Map<number, DOMRect>();
      originRects.set(index, origin);
      thumbs.forEach((i) => {
        const el = rootRef.current?.querySelector<HTMLElement>(`[data-cs-index="${i}"] [data-cs-imgwrap]`);
        if (el) originRects.set(i, el.getBoundingClientRect());
      });
      originRectsRef.current = originRects;
      setContent({ index, thumbs });
    },
    [],
  );

  const originRectsRef = React.useRef<Map<number, DOMRect>>(new Map());
  const openedRef = React.useRef(false);

  // Run the open / switch animation once the overlay DOM reflects `content`.
  useIso(() => {
    if (!content) return;
    const st = state.current;
    const overlay = overlayRef.current;
    const focus = focusRef.current;
    if (!overlay || !focus) return;
    const photo = photos[content.index];
    const target = focusTarget(photo);

    if (!openedRef.current) {
      // First open: fly the focus in from the clicked item, fly thumbs to the nav.
      openedRef.current = true;
      lenis()?.stop();
      st.scrub.forEach((t) => t.disable(false));
      overlay.classList.add("is-open");
      const origin = originRectsRef.current.get(content.index);
      const tl = gsap.timeline({
        defaults: { duration: 1.4, ease: "expo.inOut" },
        onComplete: () => {
          st.isAnimating = false;
        },
      });
      tl.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out" }, 0);
      if (origin) {
        tl.fromTo(
          focus,
          { left: origin.left, top: origin.top, width: origin.width, height: origin.height, autoAlpha: 1 },
          { left: target.left, top: target.top, width: target.width, height: target.height },
          0,
        );
      }
      // Thumbs fly from their grid positions to the nav row.
      const thumbEls = navRef.current ? gsap.utils.toArray<HTMLElement>(navRef.current.children) : [];
      thumbEls.forEach((el, i) => {
        const src = originRectsRef.current.get(content.thumbs[i]);
        const dst = el.getBoundingClientRect();
        if (src) {
          tl.fromTo(
            el,
            {
              autoAlpha: 0,
              x: src.left + src.width / 2 - (dst.left + dst.width / 2),
              y: src.top + src.height / 2 - (dst.top + dst.height / 2),
              scale: src.height / dst.height,
            },
            { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 1.1, ease: "expo.out", delay: 0.03 * i },
            0.2,
          );
        }
      });
      // Split heading parts; meta + back reveal.
      if (headingRef.current) {
        const [up, down] = headingRef.current.children as unknown as HTMLElement[];
        if (up && down) {
          tl.to(up, { yPercent: -120, autoAlpha: 0 }, 0).to(down, { yPercent: 120, autoAlpha: 0 }, 0.05);
        }
      }
      tl.fromTo(
        [metaRef.current, backRef.current],
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.5, ease: "power2.out" },
        0.8,
      );
      tl.fromTo(
        metaRef.current?.querySelectorAll(".cs-meta-line") ?? [],
        { yPercent: 120, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, stagger: 0.06, duration: 0.7, ease: "expo.out" },
        0.85,
      );
    } else {
      // Switch focused photo (thumb click): quick crossfade of the focus image + meta.
      gsap.fromTo(focus, { autoAlpha: 0.2 }, { autoAlpha: 1, duration: 0.4, ease: "power2.out" });
      gsap.set(focus, { left: target.left, top: target.top, width: target.width, height: target.height });
      gsap.fromTo(
        metaRef.current?.querySelectorAll(".cs-meta-line") ?? [],
        { yPercent: 60, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, stagger: 0.05, duration: 0.5, ease: "expo.out" },
      );
    }
  }, [content, photos, focusTarget]);

  const closeContent = React.useCallback(() => {
    const st = state.current;
    const overlay = overlayRef.current;
    const focus = focusRef.current;
    if (!st.open || st.isAnimating || !overlay || !focus || !content) return;
    st.isAnimating = true;
    const origin = originRectsRef.current.get(content.index);
    const tl = gsap.timeline({
      defaults: { duration: 1.1, ease: "expo.inOut" },
      onComplete: () => {
        overlay.classList.remove("is-open");
        gsap.set(overlay, { autoAlpha: 0 });
        openedRef.current = false;
        st.open = false;
        lenis()?.start();
        st.scrub.forEach((t) => t.enable());
        ScrollTrigger.refresh();
        st.isAnimating = false;
        setContent(null);
      },
    });
    tl.to([metaRef.current, backRef.current], { autoAlpha: 0, duration: 0.4 }, 0);
    const thumbEls = navRef.current ? gsap.utils.toArray<HTMLElement>(navRef.current.children) : [];
    tl.to(thumbEls, { autoAlpha: 0, y: 40, duration: 0.5, stagger: 0.02 }, 0);
    if (origin) {
      tl.to(focus, { left: origin.left, top: origin.top, width: origin.width, height: origin.height }, 0.1);
    }
    if (headingRef.current) {
      const [up, down] = headingRef.current.children as unknown as HTMLElement[];
      if (up && down) tl.to([up, down], { yPercent: 0, autoAlpha: 1, duration: 0.8 }, 0.2);
    }
    tl.to(overlay, { autoAlpha: 0, duration: 0.4 }, "-=0.3");
  }, [content]);

  // Esc closes the content view.
  React.useEffect(() => {
    if (!content) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContent();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [content, closeContent]);

  if (photos.length === 0) return null;

  const focusPhoto = content ? photos[content.index] : null;
  const focusUrl = focusPhoto ? pickUrl(focusPhoto, FOCUS_BUCKETS) : null;

  return (
    <div ref={rootRef} data-cs-root className="cs-root">
      {title ? (
        <div ref={headingRef} className="cs-heading">
          <span className="cs-heading-line">{title}</span>
          <span className="cs-heading-line" aria-hidden>
            {title}
          </span>
        </div>
      ) : null}

      <div className="cs-columns">
        {columns.map((col, ci) => (
          <div key={ci} data-cs-column data-cs-col={ci} className="cs-column">
            {col.map(({ photo, index }) => {
              const url = pickUrl(photo, COL_BUCKETS);
              const caption = photo.headline || photo.altText || "";
              return (
                <figure
                  key={photo.id}
                  data-cs-item
                  data-cs-index={index}
                  className="cs-item"
                  onClick={(e) => {
                    if (state.current.enhanced) {
                      const wrap = (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-cs-imgwrap]");
                      if (wrap) openContent(index, wrap);
                    }
                  }}
                >
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

      {/* Full-screen content view (fixed overlay; clones, not the clipped real items). */}
      <div ref={overlayRef} data-cs-overlay className="cs-overlay">
        <div className="cs-overlay-bg" />
        <button ref={backRef} type="button" className="cs-overlay-back" onClick={closeContent}>
          ← Back
        </button>
        <div
          ref={focusRef}
          className="cs-focus"
          style={{ backgroundImage: focusUrl ? `url(${focusUrl})` : undefined }}
        />
        <div ref={metaRef} className="cs-overlay-meta">
          <h3 className="cs-meta-line cs-meta-title">{focusPhoto?.headline || title || ""}</h3>
          {focusPhoto?.caption ? <p className="cs-meta-line cs-meta-text">{focusPhoto.caption}</p> : null}
        </div>
        <div ref={navRef} className="cs-overlay-nav">
          {content?.thumbs.map((i) => {
            const url = pickUrl(photos[i], COL_BUCKETS);
            return (
              <button
                key={i}
                type="button"
                className="cs-overlay-thumb"
                style={{ backgroundImage: url ? `url(${url})` : undefined }}
                onClick={() => {
                  if (!state.current.isAnimating) setContent((c) => (c ? { ...c, index: i } : c));
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
