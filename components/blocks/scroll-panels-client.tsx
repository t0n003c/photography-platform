"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import type { ShowcasePanel } from "./scroll-showcase-client";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const PANEL_BUCKETS = ["medium", "large", "small"];
const ROW_BUCKETS = ["small", "medium", "large"];
type ScrollPanelsVariant =
  | "classic"
  | "scatter"
  | "demo4"
  | "perspective";
type ScrollPanelsTone = "color" | "grayscale";
type ScrollPanelsIntroAlign = "left" | "center" | "right";

function pickUrl(photo: PhotoDTO, buckets: string[]): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const b of buckets) {
    const m = webp.find((v) => v.sizeBucket === b);
    if (m) return m.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function distribute<T>(items: T[], count: number): T[][] {
  const cols: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, i) => cols[i % count].push(item));
  return cols;
}

function uniquePhotos(panels: ShowcasePanel[]): PhotoDTO[] {
  const seen = new Set<string>();
  const photos: PhotoDTO[] = [];
  for (const panel of panels) {
    for (const photo of [panel.background, ...panel.cluster]) {
      if (seen.has(photo.id)) continue;
      seen.add(photo.id);
      photos.push(photo);
    }
  }
  return photos;
}

function distanceFromCenter(target: HTMLElement, spread = 420) {
  const rect = target.getBoundingClientRect();
  const el = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const win = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const dx = Math.abs(win.x - el.x);
  const dy = Math.abs(win.y - el.y);
  const distance = Math.hypot(dx, dy);
  const scaledSpread = Math.max(spread - (distance / 5000) * spread, 0);
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * scaledSpread * (el.x < win.x ? -1 : 1);
  const y = Math.sin(angle) * scaledSpread * (el.y < win.y ? -1 : 1);
  return { x, y };
}

const variantLabels: Record<ScrollPanelsVariant, string> = {
  classic: "classic",
  scatter: "scatter",
  demo4: "demo4",
  perspective: "perspective",
};

// ScrollPanels-style editorial section, adapted from Codrops ScrollPanels.
// Deviation: the reference creates its own Lenis instance; this app already owns
// global Lenis, so we only add ScrollTrigger transforms here.
export function ScrollPanelsClient({
  panels,
  title,
  showTitles,
  variant,
  introCount,
  rowCount,
  tone,
  introAlign,
  useBackground,
  background,
  textColor,
  introHeading,
  introText,
  showcaseHeading,
}: {
  panels: ShowcasePanel[];
  title: string;
  showTitles: boolean;
  variant: ScrollPanelsVariant;
  introCount: number;
  rowCount: number;
  tone: ScrollPanelsTone;
  introAlign: ScrollPanelsIntroAlign;
  useBackground: boolean;
  background: string;
  textColor: string;
  introHeading: string;
  introText: string;
  showcaseHeading: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const panelPhotos = React.useMemo(
    () => uniquePhotos(panels).slice(0, introCount),
    [introCount, panels],
  );
  const columnCount = variant === "perspective" ? 4 : 3;
  const columns = React.useMemo(
    () => distribute(panelPhotos, columnCount),
    [columnCount, panelPhotos],
  );
  const topStackedIntro = variant === "classic" || variant === "demo4";

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) {
      root.classList.add("is-reduced-motion");
      return () => root.classList.remove("is-reduced-motion");
    }

    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const columnsPanel = root.querySelector<HTMLElement>("[data-sp-columns]");
      const showcase = root.querySelector<HTMLElement>("[data-sp-showcase]");
      const wraps = gsap.utils.toArray<HTMLElement>("[data-sp-column-wrap]");
      const items = gsap.utils.toArray<HTMLElement>("[data-sp-item]");
      const images = gsap.utils.toArray<HTMLElement>("[data-sp-img]");
      if (!columnsPanel || !showcase || wraps.length === 0) return;
      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      gsap.set(columnsPanel, { autoAlpha: 0 });
      gsap.set(images, { scale: 1.08 });
      gsap.set(items, {
        filter: tone === "grayscale" ? "grayscale(100%)" : "grayscale(0%)",
      });
      if (variant === "perspective") {
        gsap.set(items, {
          rotationX: () => gsap.utils.random(14, 24),
          x: (i, target) => distanceFromCenter(target, 340).x,
          y: (i, target) => distanceFromCenter(target, 340).y,
          filter: "blur(5px)",
        });
      }

      if (topStackedIntro) {
        gsap.fromTo(
          columnsPanel,
          { autoAlpha: 0, scale: 1.1 },
          {
            autoAlpha: 1,
            scale: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: root,
              start: isMobile ? "top 82%" : "top top",
              end: () => `+=${Math.round(window.innerHeight * (isMobile ? 0.7 : 0.9))}`,
              scrub: true,
            },
          },
        );
        gsap.fromTo(columnsPanel, {
          autoAlpha: 1,
        }, {
          autoAlpha: 0,
          ease: "power3.inOut",
          immediateRender: false,
          scrollTrigger: {
            trigger: showcase,
            start: "top bottom",
            end: "top top",
            scrub: true,
          },
        });
      } else if (isMobile) {
        gsap.fromTo(
          columnsPanel,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: root,
              start: "top 92%",
              end: "top 20%",
              scrub: true,
            },
          },
        );
      } else {
        ScrollTrigger.create({
          trigger: root,
          start: "top top",
          endTrigger: showcase,
          end: "top 45%",
          onEnter: () => gsap.to(columnsPanel, { autoAlpha: 1, duration: 0.2 }),
          onEnterBack: () => gsap.to(columnsPanel, { autoAlpha: 1, duration: 0.2 }),
          onLeave: () => gsap.to(columnsPanel, { autoAlpha: 0, duration: 0.35 }),
          onLeaveBack: () => gsap.to(columnsPanel, { autoAlpha: 0, duration: 0.35 }),
        });
        gsap.fromTo(
          columnsPanel,
          { autoAlpha: 1 },
          {
            autoAlpha: 0,
            ease: "none",
            immediateRender: false,
            scrollTrigger: {
              trigger: showcase,
              start: "top bottom",
              end: "top 45%",
              scrub: true,
            },
          },
        );
      }

      const columnDrift: Record<ScrollPanelsVariant, (i: number) => number> = {
        classic: (i) => (i % 2 ? (isMobile ? 18 : 3) : isMobile ? -18 : -3),
        scatter: (i) => {
          return i % 2 ? (isMobile ? 18 : 6) : isMobile ? -18 : -6;
        },
        // Codrops demo 4: angled bands with staggered vertical travel. The
        // visually lower band moves least, the middle faster, and the upper
        // band fastest once the section is rotated.
        demo4: (i) => {
          const step = isMobile ? -48 : -15;
          return i * step + step;
        },
        perspective: (i) => (i % 2 ? 8 : -8),
      };
      const panelStartScale: Record<ScrollPanelsVariant, number> = {
        classic: 1,
        scatter: isMobile ? 0.7 : 0.62,
        demo4: 1,
        perspective: 0.7,
      };
      const imageScale: Record<ScrollPanelsVariant, number> = {
        classic: isMobile ? 1.22 : 1.08,
        scatter: 1.4,
        demo4: 1.08,
        perspective: 1.4,
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      if (!topStackedIntro) {
        tl.fromTo(
          columnsPanel,
          {
            scale: variant === "perspective" && isMobile ? 1 : panelStartScale[variant],
            y: 0,
          },
          { scale: 1, y: 0 },
          0,
        );
      }

      tl.to(wraps, { yPercent: (i) => columnDrift[variant](i) }, 0)
        .to(images, { scale: imageScale[variant] }, 0);

      if (variant === "scatter") {
        const scatterSpread = isMobile ? 720 : 380;
        gsap.to(items, {
          x: (i, target) => distanceFromCenter(target, scatterSpread).x,
          y: (i, target) => distanceFromCenter(target, scatterSpread).y,
          ease: "power2.out",
          scrollTrigger: {
            trigger: showcase,
            start: isMobile ? "top 92%" : "top 78%",
            end: isMobile ? "top 34%" : "top 22%",
            scrub: true,
          },
        });
      } else if (variant === "perspective") {
        gsap.to(items, {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          filter: "blur(0px)",
          ease: "power2.out",
          scrollTrigger: {
            trigger: root,
            start: isMobile ? "top 85%" : "top top",
            end: isMobile
              ? "top 10%"
              : () => `+=${Math.round(window.innerHeight * 0.85)}`,
            scrub: true,
          },
        });
      } else if (tone === "grayscale") {
        gsap.to(items, {
          filter: "grayscale(0%)",
          ease: "power3.inOut",
          scrollTrigger: {
            trigger: showcase,
            start: "top bottom",
            end: "top top",
            scrub: true,
          },
        });
      }

      ScrollTrigger.refresh();
    }, root);

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
    };
  }, [panels, tone, variant]);

  return (
    <section
      ref={rootRef}
      className="sp-root"
      data-sp-variant={variantLabels[variant]}
      data-sp-intro-align={introAlign}
      style={{
        ["--sp-bg" as string]: useBackground ? background : "transparent",
        ["--sp-ink" as string]: useBackground ? textColor : "hsl(var(--foreground))",
        ["--sp-cover-bg" as string]: useBackground ? background : "hsl(var(--background))",
      }}
    >
      {topStackedIntro && (
        <section className="sp-intro">
          {title && <p className="sp-eyebrow">{title}</p>}
          {introHeading && (
            <h2 className="sp-title">
              {introHeading.split(/\n+/).map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </h2>
          )}
          {introText && <p className="sp-copy">{introText}</p>}
        </section>
      )}

      <div data-sp-columns className="sp-columns-panel" aria-hidden>
        <div className="sp-columns">
          {columns.map((col, ci) => (
            <div key={ci} data-sp-column-wrap className="sp-column-wrap">
              <div className="sp-column">
                {col.map((photo, pi) => {
                  const url = pickUrl(photo, PANEL_BUCKETS);
                  if (!url) return null;
                  return (
                    <div key={photo.id + pi} data-sp-item className="sp-item">
                      <div
                        data-sp-img
                        className="sp-item-img"
                        style={{ backgroundImage: `url(${url})` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!topStackedIntro && (
        <section className="sp-intro">
          {title && <p className="sp-eyebrow">{title}</p>}
          {introHeading && (
            <h2 className="sp-title">
              {introHeading.split(/\n+/).map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </h2>
          )}
          {introText && <p className="sp-copy">{introText}</p>}
        </section>
      )}

      <section data-sp-showcase className="sp-showcase">
        <header className="sp-showcase-header">
          <span>{String(new Date().getFullYear() - panels.length + 1)}</span>
          {showcaseHeading && (
            <h2>
              {showcaseHeading.split(/\n+/).map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </h2>
          )}
          <span>{String(new Date().getFullYear())}</span>
        </header>

        <div className="sp-rows">
          {panels.map((panel, i) => {
            const rowPhotos = [panel.background, ...panel.cluster].slice(0, rowCount);
            return (
              <article key={panel.slug + i} className="sp-row">
                <Link href={`/categories/${panel.slug}`} className="sp-row-header">
                  <span className="sp-row-index">{String(i + 1).padStart(2, "0")}</span>
                  <span className="sp-row-title">{showTitles ? panel.name : ""}</span>
                  <span className="sp-row-action">Open gallery</span>
                </Link>
                <div className="sp-row-images">
                  {rowPhotos.map((photo, pi) => {
                    const url = pickUrl(photo, ROW_BUCKETS);
                    if (!url) return null;
                    return (
                      <div key={photo.id + pi} className="sp-row-imgwrap">
                        <div
                          className="sp-row-img"
                          style={{ backgroundImage: `url(${url})` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
