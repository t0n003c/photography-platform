"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import type { ShowcasePanel } from "./scroll-showcase-client";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const BUCKETS = ["medium", "large", "small"];

export type LayoutFormationVariant =
  | "rise"
  | "columns"
  | "zoomed"
  | "reveal"
  | "tilted"
  | "depth"
  | "sidePivot";
type LayoutFormationHeaderAlign = "left" | "center" | "right";

const variantLabels: Record<LayoutFormationVariant, string> = {
  rise: "Rise grid",
  columns: "Column assemble",
  zoomed: "Zoomed grid",
  reveal: "Column reveal",
  tilted: "Tilted fly-in",
  depth: "3D depth fly-in",
  sidePivot: "Side pivot",
};

function pickUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function photosForPanel(panel: ShowcasePanel): PhotoDTO[] {
  const seen = new Set<string>();
  const photos: PhotoDTO[] = [];
  for (const photo of [panel.background, ...panel.cluster]) {
    if (seen.has(photo.id) || photo.variants.length === 0) continue;
    seen.add(photo.id);
    photos.push(photo);
  }
  return photos;
}

function distanceFromCenter(target: HTMLElement, spread = 360) {
  const rect = target.getBoundingClientRect();
  const elX = rect.left + rect.width / 2;
  const elY = rect.top + rect.height / 2;
  const winX = window.innerWidth / 2;
  const winY = window.innerHeight / 2;
  const dx = Math.abs(winX - elX);
  const dy = Math.abs(winY - elY);
  const angle = Math.atan2(dy, dx);
  return {
    x: Math.cos(angle) * spread * (elX < winX ? -1 : 1),
    y: Math.sin(angle) * spread * (elY < winY ? -1 : 1),
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const next = [...items];
  let value = 0;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 31 + seed.charCodeAt(i)) >>> 0;
  }
  for (let i = next.length - 1; i > 0; i -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const j = value % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

// Codrops OnScrollLayoutFormations adaptation. Deviation: the reference pins
// every formation on all viewports; we pin only on desktop to avoid the mobile
// browser chrome/layout-shift issue noted in the upstream repo.
export function LayoutFormationsClient({
  panels,
  title,
  showTitles,
  variant,
  photoCount,
  headerAlign,
}: {
  panels: ShowcasePanel[];
  title: string;
  showTitles: boolean;
  variant: LayoutFormationVariant;
  photoCount: number;
  headerAlign: LayoutFormationHeaderAlign;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const effectivePhotoCount = variant === "zoomed" ? 9 : photoCount;

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
      const sections = gsap.utils.toArray<HTMLElement>("[data-lf-section]");
      const isDesktop = window.matchMedia("(min-width: 769px)").matches;

      sections.forEach((section) => {
        const grid = section.querySelector<HTMLElement>("[data-lf-grid]");
        const images = gsap.utils.toArray<HTMLElement>(
          section.querySelectorAll("[data-lf-img]"),
        );
        const titleBlock = section.querySelector<HTMLElement>("[data-lf-title]");
        if (!grid || images.length === 0) return;

        if (!isDesktop) {
          gsap.from(images, {
            y: 42,
            autoAlpha: 0,
            stagger: 0.04,
            ease: "power2.out",
            scrollTrigger: {
              trigger: section,
              start: "top 78%",
              end: "top 35%",
              scrub: true,
            },
          });
          return;
        }

        const shuffledImages = seededShuffle(
          images,
          `${variant}-${section.dataset.lfPanel ?? "0"}-${images.length}`,
        );
        const isEntranceFormation =
          variant === "tilted" || variant === "depth" || variant === "sidePivot";
        if (variant === "columns") {
          const rows = new Map<string, HTMLElement[]>();
          for (const image of images) {
            const row = image.dataset.lfRow ?? "0";
            rows.set(row, [...(rows.get(row) ?? []), image]);
          }
          const layoutPageTop = (element: HTMLElement) => {
            let top = 0;
            let node: HTMLElement | null = element;
            while (node) {
              top += node.offsetTop;
              node = node.offsetParent as HTMLElement | null;
            }
            return top;
          };

          rows.forEach((rowImages, row) => {
            gsap
              .timeline({
                defaults: { ease: "sine.inOut" },
                scrollTrigger: {
                  trigger: section,
                  start: () => layoutPageTop(rowImages[0]) - window.innerHeight * 0.98,
                  end: () => layoutPageTop(rowImages[0]) - window.innerHeight * 0.68,
                  scrub: 0.35,
                },
              })
              .fromTo(
                seededShuffle(rowImages, `${section.dataset.lfPanel ?? "0"}-${row}`),
                {
                  autoAlpha: 0,
                  y: window.innerHeight * 0.45,
                  transformOrigin: "50% 0%",
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  stagger: 0.13,
                },
              );
          });
          return;
        }
        const triggerStart =
          variant === "rise"
            ? "top 50%"
            : variant === "zoomed"
              ? "top 5%"
              : variant === "reveal"
                ? "top 76%"
                : isEntranceFormation
                  ? "top 86%"
                  : "center center";
        const triggerEnd =
          variant === "rise"
            ? `+=${Math.round(window.innerHeight * 0.62)}`
            : variant === "zoomed"
              ? `+=${Math.round(window.innerHeight * 0.58)}`
                : variant === "reveal"
                  ? "top 16%"
                  : isEntranceFormation
                    ? "bottom 42%"
                    : `+=${Math.round(window.innerHeight * 2.2)}`;
        const tl = gsap.timeline({
          defaults: {
            ease:
              variant === "zoomed"
                ? "power2.inOut"
                : variant === "tilted"
                  ? "power3.inOut"
                  : variant === "depth"
                    ? "sine.inOut"
                    : variant === "sidePivot"
                      ? "expo.inOut"
                      : "sine.inOut",
          },
          scrollTrigger: {
            trigger: section,
            start: triggerStart,
            end: () => triggerEnd,
            pin: variant !== "rise" && variant !== "reveal" && !isEntranceFormation,
            scrub: variant === "rise" || variant === "sidePivot" ? 0.2 : 0.35,
          },
        });

        if (variant === "rise") {
          tl.from(shuffledImages, {
            duration: 1.55,
            stagger: 0.055,
            autoAlpha: 0,
            y: () => gsap.utils.random(window.innerHeight * 0.55, window.innerHeight * 1.05),
          });
          if (titleBlock) {
            tl.from(
              titleBlock,
              { yPercent: 160, autoAlpha: 0, duration: 1.1, ease: "power4.out" },
              0.75,
            );
          }
        } else if (variant === "zoomed") {
          tl.set(grid, {
            transformOrigin: "50% 50%",
          });
          tl.fromTo(
            images,
            {
              scale: 0.7,
              autoAlpha: 0,
            },
            {
              stagger: { amount: 0.18, from: "edges", grid: [3, 3] },
              scale: 1,
              autoAlpha: 1,
            },
            0,
          ).fromTo(
            grid,
            {
              scale: 0.72,
              skewY: 5,
              rotationZ: -1.5,
            },
            {
              scale: 1,
              skewY: 0,
              rotationZ: 0,
            },
            0,
          );
          if (titleBlock) {
            tl.from(titleBlock, { yPercent: 70, autoAlpha: 0 }, 0.2);
          }
        } else if (variant === "reveal") {
          tl.fromTo(
            shuffledImages,
            { autoAlpha: 0, yPercent: -120 },
            { stagger: 0.055, autoAlpha: 1, yPercent: 0, ease: "power1.out" },
          ).from(
            shuffledImages.map((img) => img.querySelector<HTMLElement>("[data-lf-img-inner]")),
            { stagger: 0.055, yPercent: 120, ease: "power1.out" },
            0,
          );
        } else if (variant === "tilted") {
          const middleIndex = Math.floor(images.length / 2);
          tl.from(images, {
            stagger: { amount: 0.3, from: "center" },
            y: window.innerHeight,
            transformOrigin: "50% 0%",
            rotation: (pos) => {
              const distance = Math.abs(pos - middleIndex);
              return pos < middleIndex ? distance * 3 : distance * -3;
            },
          });
          if (titleBlock) {
            tl.from(
              titleBlock,
              { yPercent: 70, autoAlpha: 0, duration: 1, ease: "power4.out" },
              0.15,
            );
          }
        } else if (variant === "depth") {
          tl.set(grid, { perspective: 1000 });
          tl.from(shuffledImages, {
            stagger: { amount: 0.4, from: "random" },
            y: window.innerHeight,
            rotationX: -70,
            transformOrigin: "50% 0%",
            z: -900,
            autoAlpha: 0,
          });
          if (titleBlock) {
            tl.from(
              titleBlock,
              { yPercent: 95, autoAlpha: 0, duration: 1.15, ease: "power4.out" },
              0.35,
            );
          }
        } else if (variant === "sidePivot") {
          tl.set(grid, { perspective: 2000 });
          tl.from(images, {
            stagger: { amount: 0.8, from: "start" },
            rotationY: 65,
            transformOrigin: "0% 50%",
            z: -200,
            yPercent: 10,
          }).from(
            images,
            {
              stagger: { amount: 0.8, from: "start" },
              duration: 0.2,
              autoAlpha: 0,
            },
            0,
          );
          if (titleBlock) {
            tl.from(
              titleBlock,
              { xPercent: -18, autoAlpha: 0, duration: 0.8 },
              0.28,
            );
          }
        }

        if (variant === "zoomed") {
          tl.from(
            images,
            {
              x: (i, target) =>
                i === 4 ? 0 : distanceFromCenter(target as HTMLElement, 70).x,
              y: (i, target) =>
                i === 4 ? 0 : distanceFromCenter(target as HTMLElement, 70).y,
              rotationZ: (i) => (i === 4 ? 0 : i < 4 ? -3 : 3),
            },
            0,
          );
        }
      });

      ScrollTrigger.refresh();
    }, root);

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
    };
  }, [effectivePhotoCount, variant]);

  return (
    <section
      ref={rootRef}
      className="lf-root"
      data-lf-variant={variant}
      data-lf-count={effectivePhotoCount}
      data-lf-header-align={headerAlign}
      data-lf-show-titles={showTitles ? "true" : "false"}
    >
      <header className="lf-header">
        {title && <p className="lf-eyebrow">{title}</p>}
        <h2>Layout formations</h2>
        <p>{variantLabels[variant]}</p>
      </header>

      {panels.map((panel, panelIndex) => {
        const photos = photosForPanel(panel);
        const count = effectivePhotoCount;
        const filled =
          photos.length === 0
            ? []
            : Array.from({ length: count }, (_, i) => photos[i % photos.length]);
        if (filled.length === 0) return null;

        return (
          <section
            key={panel.slug + panelIndex}
            className={`lf-section ${panelIndex === 0 ? "lf-section--first" : ""}`}
            data-lf-panel={panelIndex}
            data-lf-section
          >
            <div className="lf-stage">
              <div className="lf-grid" data-lf-grid>
                {filled.map((photo, i) => {
                  const url = pickUrl(photo);
                  if (!url) return null;
                  return (
                    <div
                      key={`${photo.id}-${i}`}
                      className="lf-img"
                      data-lf-img
                      data-lf-row={Math.floor(i / 6)}
                    >
                      <div
                        className="lf-img-inner"
                        data-lf-img-inner
                        style={{ backgroundImage: `url(${url})` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="lf-title" data-lf-title>
                <span>{String(panelIndex + 1).padStart(2, "0")}</span>
                {showTitles && <h3>{panel.name}</h3>}
              </div>
            </div>
          </section>
        );
      })}
    </section>
  );
}
