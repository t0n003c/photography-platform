"use client";

import * as React from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import type { ShowcasePanel } from "./scroll-showcase-client";

export type ScrollLayoutsVariant =
  | "row"
  | "breakout"
  | "grid10"
  | "stackDark"
  | "stackGlass"
  | "stackScale"
  | "tiny"
  | "bento"
  | "single";

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const BUCKETS = ["medium", "large", "small"];

const VARIANT_LABELS: Record<ScrollLayoutsVariant, string> = {
  row: "Row focus",
  breakout: "Breakout grid",
  grid10: "Long grid",
  stackDark: "Dark stack",
  stackGlass: "Glass stack",
  stackScale: "Scale stack",
  tiny: "Tiny grid",
  bento: "Bento spread",
  single: "Single image reveal",
};

const DEFAULT_COUNTS: Record<ScrollLayoutsVariant, number> = {
  row: 7,
  breakout: 9,
  grid10: 16,
  stackDark: 6,
  stackGlass: 6,
  stackScale: 6,
  tiny: 80,
  bento: 8,
  single: 1,
};

const ROW_SIZE_CLASSES = [
  "sbl-gallery__item--s",
  "sbl-gallery__item--m",
  "sbl-gallery__item--l",
  "sbl-gallery__item--xl sbl-gallery__item--center",
  "sbl-gallery__item--l",
  "sbl-gallery__item--m",
  "sbl-gallery__item--s",
];

function pickUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function panelPhotos(panel: ShowcasePanel): PhotoDTO[] {
  const seen = new Set<string>();
  const photos: PhotoDTO[] = [];
  for (const photo of [panel.background, ...panel.cluster]) {
    if (seen.has(photo.id) || photo.variants.length === 0) continue;
    seen.add(photo.id);
    photos.push(photo);
  }
  return photos;
}

function photosForVariant(panel: ShowcasePanel, variant: ScrollLayoutsVariant, count: number) {
  const photos = panelPhotos(panel);
  const fixedCount = variant === "tiny" ? count : DEFAULT_COUNTS[variant];
  const target = Math.max(1, Math.min(fixedCount || DEFAULT_COUNTS[variant], 80));
  if (photos.length === 0) return [];
  return Array.from({ length: target }, (_, i) => photos[i % photos.length]);
}

function galleryClass(variant: ScrollLayoutsVariant) {
  const classes = ["sbl-gallery"];
  if (variant === "row") classes.push("sbl-gallery--row");
  if (variant === "breakout") classes.push("sbl-gallery--grid", "sbl-gallery--breakout");
  if (variant === "grid10") classes.push("sbl-gallery--grid10");
  if (variant === "stackDark") classes.push("sbl-gallery--stack", "sbl-gallery--stack-inverse", "sbl-gallery--stack-dark");
  if (variant === "stackGlass") classes.push("sbl-gallery--stack", "sbl-gallery--stack-glass");
  if (variant === "stackScale") classes.push("sbl-gallery--stack", "sbl-gallery--stack-inverse", "sbl-gallery--stack-scale", "sbl-gallery--stack-dark");
  if (variant === "tiny") classes.push("sbl-gallery--gridtiny");
  if (variant === "bento") classes.push("sbl-gallery--bento");
  if (variant === "single") classes.push("sbl-gallery--one");
  return classes.join(" ");
}

function itemClass(variant: ScrollLayoutsVariant, index: number) {
  const classes = ["sbl-gallery__item"];
  if (variant === "row") classes.push(...ROW_SIZE_CLASSES[index % ROW_SIZE_CLASSES.length].split(" "));
  if (variant === "breakout") classes.push("sbl-gallery__item-cut");
  if (variant === "grid10") classes.push(`pos-${(index % 16) + 1}`);
  return classes.join(" ");
}

function flipOptions(variant: ScrollLayoutsVariant, isMobile: boolean) {
  if (variant === "row") {
    return {
      flip: { absoluteOnLeave: true, absolute: false, scale: false, simple: true },
      end: isMobile ? "+=180%" : "+=300%",
      stagger: 0,
    };
  }
  if (variant === "grid10") {
    return {
      flip: { absoluteOnLeave: false, absolute: true, scale: false, simple: true },
      end: isMobile ? "+=320%" : "+=900%",
      stagger: isMobile ? 0.025 : 0.05,
    };
  }
  if (variant === "bento") {
    return {
      flip: { absoluteOnLeave: false, absolute: false, scale: false, simple: true },
      end: isMobile ? "+=220%" : "+=300%",
      stagger: 0,
    };
  }
  return {
    flip: { absoluteOnLeave: false, absolute: false, scale: true, simple: true },
    end: isMobile ? "+=210%" : "+=300%",
    stagger: 0,
  };
}

// Codrops ScrollBasedLayoutAnimations adaptation. Deviation: the reference
// creates its own Lenis instance; this component uses the app's global Lenis and
// only attaches GSAP ScrollTrigger/Flip transforms.
export function ScrollLayoutsClient({
  panels,
  title,
  showTitles,
  variant,
  photoCount,
  heading,
  introText,
  caption,
  useBackground,
  background,
  textColor,
}: {
  panels: ShowcasePanel[];
  title: string;
  showTitles: boolean;
  variant: ScrollLayoutsVariant;
  photoCount: number;
  heading: string;
  introText: string;
  caption: string;
  useBackground: boolean;
  background: string;
  textColor: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);

  useIsoLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const galleries = gsap.utils.toArray<HTMLElement>("[data-sbl-gallery]", root);
    if (prefersReducedMotion()) {
      root.classList.add("is-reduced-motion");
      galleries.forEach((gallery) => gallery.classList.add("sbl-gallery--switch"));
      return () => {
        root.classList.remove("is-reduced-motion");
        galleries.forEach((gallery) => gallery.classList.remove("sbl-gallery--switch"));
      };
    }

    gsap.registerPlugin(ScrollTrigger, Flip);
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;

      galleries.forEach((gallery) => {
        const section = gallery.closest<HTMLElement>("[data-sbl-section]");
        if (!section) return;
        const items = gsap.utils.toArray<HTMLElement>("[data-sbl-item]", gallery);
        const captionEl = gallery.querySelector<HTMLElement>("[data-sbl-caption]");
        const inners = gsap.utils.toArray<HTMLElement>("[data-sbl-inner]", gallery);
        const targets = captionEl ? [...items, captionEl] : items;
        if (targets.length === 0) return;

        gallery.classList.add("sbl-gallery--switch");
        const state = Flip.getState(targets, { props: "filter,opacity" });
        gallery.classList.remove("sbl-gallery--switch");

        const options = flipOptions(variant, isMobile);
        Flip.to(state, {
          ease: "none",
          absoluteOnLeave: options.flip.absoluteOnLeave,
          absolute: options.flip.absolute,
          scale: options.flip.scale,
          simple: options.flip.simple,
          stagger: options.stagger,
          scrollTrigger: {
            trigger: gallery,
            start: isMobile ? "top 54%" : "center center",
            end: options.end,
            pin: section,
            scrub: true,
          },
        });

        if (inners.length > 0) {
          gsap.fromTo(
            inners,
            { scale: variant === "single" ? 1.18 : 2 },
            {
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: gallery,
                start: isMobile ? "top 54%" : "center center",
                end: options.end,
                scrub: true,
              },
            },
          );
        }
      });

      ScrollTrigger.refresh();
    }, root);

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
    };
  }, [variant, photoCount, panels]);

  return (
    <section
      ref={rootRef}
      className="sbl-root"
      data-sbl-variant={variant}
      style={{
        ["--sbl-bg" as string]: useBackground ? background : "hsl(var(--background))",
        ["--sbl-text" as string]: useBackground ? textColor : "hsl(var(--foreground))",
      }}
    >
      <header className="sbl-header">
        {title && <p>{title}</p>}
        {heading && <h2>{heading}</h2>}
        {introText && <div className="sbl-header__copy">{introText}</div>}
        <span>{VARIANT_LABELS[variant]}</span>
      </header>

      {panels.map((panel, panelIndex) => {
        const photos = photosForVariant(panel, variant, photoCount);
        const captionText = caption.trim() || panel.name;
        const showOutsideTitle = showTitles && variant !== "row" && variant !== "breakout";
        if (photos.length === 0) return null;

        return (
          <section
            key={`${panel.slug}-${panelIndex}`}
            className={`sbl-section ${variant === "breakout" ? "sbl-section--large" : ""} ${
              variant === "stackDark" || variant === "stackGlass" || variant === "stackScale"
                ? "sbl-section--dense"
                : ""
            }`}
            data-sbl-section
          >
            {showOutsideTitle && (
              <div className="sbl-project">
                <span>{String(panelIndex + 1).padStart(2, "0")}</span>
                <h3>{panel.name}</h3>
              </div>
            )}
            <div className="sbl-gallery-wrap">
              <div className={galleryClass(variant)} data-sbl-gallery>
                {photos.map((photo, index) => {
                  const url = pickUrl(photo);
                  if (!url) return null;
                  const content = (
                    <div
                      className="sbl-gallery__item-inner"
                      data-sbl-inner
                      style={{ backgroundImage: `url(${url})` }}
                    />
                  );
                  return (
                    <div
                      key={`${photo.id}-${index}`}
                      className={itemClass(variant, index)}
                      data-sbl-item
                      style={variant === "breakout" ? undefined : { backgroundImage: `url(${url})` }}
                    >
                      {variant === "breakout" ? content : null}
                    </div>
                  );
                })}
                <div className="sbl-caption" data-sbl-caption>
                  {captionText}
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </section>
  );
}
