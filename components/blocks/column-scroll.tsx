"use client";

import * as React from "react";
import gsap from "gsap";
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
// photo grid whose OUTER columns drift opposite to the middle one as the grid
// receives wheel/touch input (hover squeeze/zoom), and a click→full-screen
// "content view": the image scales up to centre, the other in-view photos fly to a
// thumbnail nav, an optional split heading parts, and the photo's title/caption
// reveal; Back (or Esc) reverses it; nav thumbs switch the focused photo.
//
// The reference drives the columns with Locomotive Scroll, which would fight our
// global Lenis — so we keep the section fixed and drive only the column transforms
// from local wheel/touch progress. Because our columns use overflow:hidden for the
// drift, the content view animates fixed-position OVERLAY clones (not the clipped
// real items) — same visual, robust. Progressive enhancement: SSR / reduced-motion
// render a plain photo grid; GSAP enhances on mount.
export function ColumnScroll({
  photos,
  title,
  subtitle,
  useBackground = true,
  backgroundColor = "#b7b19f",
  textColor = "#111111",
  showText = true,
}: {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  useBackground?: boolean;
  backgroundColor?: string;
  textColor?: string;
  showText?: boolean;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const focusRef = React.useRef<HTMLDivElement>(null);
  const headUpRef = React.useRef<HTMLHeadingElement>(null);
  const headDownRef = React.useRef<HTMLHeadingElement>(null);
  const metaRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLButtonElement>(null);

  const state = React.useRef<{
    enhanced: boolean;
    isAnimating: boolean;
    open: boolean;
    inView: Set<number>;
    scrollProgress: number;
  }>({ enhanced: false, isAnimating: false, open: false, inView: new Set(), scrollProgress: 0.5 });

  // The focused photo + the sibling thumbnails currently shown in the content view.
  const [content, setContent] = React.useState<{ index: number; thumbs: number[] } | null>(null);

  // Responsive column count: 3 desktop / 2 mobile. The Codrops reference needs at
  // least two columns for the opposite-scroll effect to read, so phones keep two
  // columns with larger, tighter frames instead of collapsing to one.
  const [numCols, setNumCols] = React.useState(NUM_COLS);
  React.useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      setNumCols(w <= 768 ? 2 : 3);
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
    const stage = stageRef.current;
    if (!root || !stage || prefersReducedMotion() || photos.length === 0) return;

    const st = state.current;
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const cols = gsap.utils.toArray<HTMLElement>("[data-cs-column]");
      const stageStyle = window.getComputedStyle(stage);
      const verticalPadding =
        Number.parseFloat(stageStyle.paddingTop) +
        Number.parseFloat(stageStyle.paddingBottom);
      const visibleHeight = Math.max(
        1,
        (stage.clientHeight || window.innerHeight) - verticalPadding,
      );
      // Keep the scene fixed with CSS and animate only the columns. The travel is
      // measured from each column's own overflow. That lets every column reach
      // its first/last image while shorter columns move less, avoiding big blank
      // bands when the neighboring columns hit their ends.
      // Opposite-direction drift only makes sense with ≥2 columns.
      if (cols.length > 1) {
        gsap.set(cols, { y: 0 });
        const stageRect = stage.getBoundingClientRect();
        const topTarget = Number.parseFloat(stageStyle.paddingTop);
        const bottomTarget = stageRect.height - Number.parseFloat(stageStyle.paddingBottom);
        const ranges: { start: number; end: number }[] = [];
        cols.forEach((col, i) => {
          if (col.scrollHeight <= visibleHeight) {
            ranges[i] = { start: 0, end: 0 };
            return;
          }
          const items = Array.from(col.querySelectorAll<HTMLElement>("[data-cs-item]"));
          const first = items[0]?.getBoundingClientRect();
          const last = items[items.length - 1]?.getBoundingClientRect();
          if (!first || !last) {
            ranges[i] = { start: 0, end: 0 };
            return;
          }
          const firstTop = first.top - stageRect.top;
          const lastBottom = last.bottom - stageRect.top;
          const isReversedColumn = i % 2 === 1;
          const itemHeight = Math.max(first.height, last.height);
          const endpointInset = Math.min(
            visibleHeight * (isReversedColumn ? 0.08 : 0.42),
            itemHeight * (isReversedColumn ? 0.25 : 1.25),
          );
          ranges[i] = {
            start: topTarget + endpointInset - firstTop,
            end: bottomTarget - endpointInset - lastBottom,
          };
        });
        const maxTravel = Math.max(
          ...ranges.map(({ start, end }) => Math.abs(end - start)),
          0,
        );
        const applyProgress = (progress: number) => {
          st.scrollProgress = Math.min(1, Math.max(0, progress));
          cols.forEach((col, i) => {
            const { start, end } = ranges[i] ?? { start: 0, end: 0 };
            gsap.to(col, {
              y: start + (end - start) * st.scrollProgress,
              duration: 0.55,
              ease: "power3.out",
              overwrite: true,
            });
          });
        };

        applyProgress(st.scrollProgress);

        if (maxTravel > 0) {
          let touchY: number | null = null;
          const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
          const wheelDeltaScale = Math.max(visibleHeight * 1.2, maxTravel * 1.6);
          const touchDeltaScale = Math.max(visibleHeight * 0.55, maxTravel * 0.72);
          const onWheel = (event: WheelEvent) => {
            if (st.open) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            applyProgress(st.scrollProgress + event.deltaY / wheelDeltaScale);
          };
          const onTouchStart = (event: TouchEvent) => {
            touchY = event.touches[0]?.clientY ?? null;
          };
          const onTouchMove = (event: TouchEvent) => {
            if (st.open || touchY === null) return;
            const nextY = event.touches[0]?.clientY ?? touchY;
            event.preventDefault();
            event.stopImmediatePropagation();
            applyProgress(
              st.scrollProgress +
                (touchY - nextY) /
                  (coarsePointer ? touchDeltaScale : wheelDeltaScale),
            );
            touchY = nextY;
          };
          root.addEventListener("wheel", onWheel, { passive: false });
          root.addEventListener("touchstart", onTouchStart, { passive: true });
          root.addEventListener("touchmove", onTouchMove, { passive: false });
          return () => {
            root.removeEventListener("wheel", onWheel);
            root.removeEventListener("touchstart", onTouchStart);
            root.removeEventListener("touchmove", onTouchMove);
          };
        }
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
    return () => {
      io.disconnect();
      ctx.revert();
      root.classList.remove("is-enhanced");
      st.enhanced = false;
      st.open = false;
      st.isAnimating = false;
      lenis()?.start(); // never leave the next page scroll-locked
    };
  }, [photos, numCols]);

  // Geometry helper: the centred target box for the focused image (≈70vh tall).
  const focusTarget = React.useCallback((photo: PhotoDTO) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ar = photo.width && photo.height ? photo.width / photo.height : 0.8;
    let h = vh * 0.62;
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
      // The framing split heading parts away as the content view covers the grid.
      if (showText) {
        if (headUpRef.current) tl.to(headUpRef.current, { yPercent: -140, autoAlpha: 0 }, 0);
        if (headDownRef.current) tl.to(headDownRef.current, { yPercent: 140, autoAlpha: 0 }, 0.05);
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
        tl.fromTo(backRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, 0.8);
      }
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
  }, [content, photos, focusTarget, showText]);

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
        st.isAnimating = false;
        setContent(null);
      },
    });
    const fadeTargets: HTMLElement[] = backRef.current ? [backRef.current] : [];
    if (showText && metaRef.current) fadeTargets.push(metaRef.current);
    tl.to(fadeTargets, { autoAlpha: 0, duration: 0.4 }, 0);
    const thumbEls = navRef.current ? gsap.utils.toArray<HTMLElement>(navRef.current.children) : [];
    tl.to(thumbEls, { autoAlpha: 0, y: 40, duration: 0.5, stagger: 0.02 }, 0);
    if (origin) {
      tl.to(focus, { left: origin.left, top: origin.top, width: origin.width, height: origin.height }, 0.1);
    }
    const heads = showText ? [headUpRef.current, headDownRef.current].filter(Boolean) : [];
    if (heads.length) tl.to(heads, { yPercent: 0, autoAlpha: 1, duration: 0.8 }, 0.2);
    tl.to(overlay, { autoAlpha: 0, duration: 0.4 }, "-=0.3");
  }, [content, showText]);

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
    <div
      ref={rootRef}
      data-cs-root
      className="cs-root"
      style={
        {
          "--cs-bg": backgroundColor,
          "--cs-bg-active": useBackground ? backgroundColor : "transparent",
          "--cs-text": textColor,
        } as React.CSSProperties
      }
    >
      <div ref={stageRef} className="cs-stage">
        {showText && title ? (
          <h2 ref={headUpRef} className="cs-heading cs-heading--up" aria-hidden>
            {title}
          </h2>
        ) : null}

        <div className="cs-columns">
          {columns.map((col, ci) => (
            <div key={ci} data-cs-column data-cs-col={ci} className="cs-column">
              {col.map(({ photo, index }) => {
                const url = pickUrl(photo, COL_BUCKETS);
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
                  </figure>
                );
              })}
            </div>
          ))}
        </div>

        {showText && (subtitle || title) ? (
          <h2 ref={headDownRef} className="cs-heading cs-heading--down" aria-hidden>
            {subtitle || title}
          </h2>
        ) : null}
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
        {showText ? (
          <div ref={metaRef} className="cs-overlay-meta">
            <h3 className="cs-meta-line cs-meta-title">{focusPhoto?.headline || title || ""}</h3>
            {focusPhoto?.caption || subtitle ? (
              <p className="cs-meta-line cs-meta-text">{focusPhoto?.caption || subtitle}</p>
            ) : null}
          </div>
        ) : null}
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
