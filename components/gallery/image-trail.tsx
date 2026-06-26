"use client";

import * as React from "react";
import gsap from "gsap";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import { JustifiedGrid } from "./grids";

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const BUCKETS = ["medium", "small", "large"];
const FULL_BUCKETS = ["large", "medium", "small"];
const MAX_TRAIL_ITEMS = 18;

export type ImageTrailVariant =
  | "fade-shrink"
  | "zoom-fade"
  | "drop"
  | "scatter"
  | "stretch-drop"
  | "full-frame";

interface TrailItem {
  photo: PhotoDTO;
  url: string;
  fullUrl: string;
}

interface ImageTrailProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  variant?: ImageTrailVariant;
  useBackground?: boolean;
  backgroundColor?: string;
  onOpen: (index: number) => void;
}

const VARIANT_THEME: Record<
  ImageTrailVariant,
  {
    bg: string;
    text: string;
    title: string;
    blend: React.CSSProperties["mixBlendMode"];
    filter?: string;
  }
> = {
  "fade-shrink": {
    bg: "#efece5",
    text: "#262523",
    title: "#ffffff",
    blend: "difference",
  },
  "zoom-fade": {
    bg: "#151413",
    text: "#ffffff",
    title: "#232323",
    blend: "difference",
  },
  drop: {
    bg: "#d02d55",
    text: "#320065",
    title: "#320065",
    blend: "normal",
    filter: "sepia(1) saturate(1) contrast(180%) brightness(80%) hue-rotate(295deg)",
  },
  scatter: {
    bg: "#e0fafb",
    text: "#000000",
    title: "#f9dae5",
    blend: "normal",
  },
  "stretch-drop": {
    bg: "#485656",
    text: "#ffffff",
    title: "#444c4c",
    blend: "normal",
    filter: "hue-rotate(70deg) contrast(70%)",
  },
  "full-frame": {
    bg: "#000000",
    text: "#ffffff",
    title: "#ffffff",
    blend: "overlay",
  },
};

function pickUrl(photo: PhotoDTO, buckets: string[]): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of buckets) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function displayTitle(title: string | undefined): string {
  const trimmed = title?.trim();
  if (!trimmed) return "Gallery";
  return trimmed;
}

/**
 * Codrops ImageTrailEffects adaptation. Intentional deviations: the original
 * uses a desktop-only body-level mouse listener and fixed demo text; ours scopes
 * pointer/touch input to the gallery stage, uses the selected gallery photos,
 * and keeps a reduced-motion/static fallback grid.
 */
export function ImageTrail({
  photos,
  title,
  subtitle,
  variant = "fade-shrink",
  useBackground = true,
  backgroundColor,
  onOpen,
}: ImageTrailProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const safeVariant = VARIANT_THEME[variant] ? variant : "fade-shrink";
  const theme = VARIANT_THEME[safeVariant];
  const stageTitle = displayTitle(title);
  const trailItems = React.useMemo<TrailItem[]>(
    () =>
      photos
        .map((photo) => {
          const url = pickUrl(photo, BUCKETS);
          const fullUrl = pickUrl(photo, FULL_BUCKETS) ?? url;
          return url && fullUrl ? { photo, url, fullUrl } : null;
        })
        .filter((item): item is TrailItem => Boolean(item))
        .slice(0, MAX_TRAIL_ITEMS),
    [photos],
  );

  useIso(() => {
    const root = rootRef.current;
    if (!root || trailItems.length === 0 || prefersReducedMotion()) return;

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const baseThreshold = safeVariant === "drop" ? 48 : safeVariant === "scatter" ? 72 : 84;
    const threshold = coarsePointer ? Math.max(24, baseThreshold * 0.45) : baseThreshold;
    let last = { x: 0, y: 0 };
    let cached = { x: 0, y: 0 };
    let firstMove = true;
    let slot = 0;
    let photoIndex = 0;

    root.dataset.imageTrail = "ready";

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>("[data-image-trail-item]");
      gsap.set(items, {
        autoAlpha: 0,
        scale: 1,
        x: 0,
        y: 0,
        rotate: 0,
      });
      if (safeVariant === "full-frame" && items[0]) {
        gsap.set(items[0], { autoAlpha: 1, zIndex: 1, x: 0, y: 0, scale: 1 });
      }

      const show = (event: PointerEvent) => {
        const rect = root.getBoundingClientRect();
        const next = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };

        if (firstMove) {
          firstMove = false;
          last = next;
          cached = next;
          return;
        }

        cached = {
          x: cached.x + (next.x - cached.x) * 0.1,
          y: cached.y + (next.y - cached.y) * 0.1,
        };

        if (distance(next, last) < threshold) return;
        const previous = last;
        last = next;

        const item = items[slot % items.length];
        const selected = trailItems[photoIndex % trailItems.length];
        slot += 1;
        photoIndex += 1;
        if (!item || !selected) return;

        const image = item as HTMLImageElement;
        if (image.tagName === "IMG") {
          image.src = selected.url;
        } else if (safeVariant === "full-frame") {
          const fullImage = item.querySelector<HTMLImageElement>("img");
          if (fullImage) fullImage.src = selected.fullUrl;
        } else {
          item.style.backgroundImage = `url(${selected.fullUrl})`;
        }

        const w = item.offsetWidth || (coarsePointer ? 132 : 250);
        const h = item.offsetHeight || (coarsePointer ? 96 : 180);
        const direction = next.x >= previous.x ? 1 : -1;

        gsap.killTweensOf(item);
        const baseSet = {
          zIndex: slot,
          x: cached.x - w / 2,
          y: cached.y - h / 2,
          autoAlpha: 1,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          rotate: 0,
        };

        if (safeVariant === "full-frame") {
          gsap
            .timeline()
            .set(item, {
              zIndex: slot,
              autoAlpha: 1,
              x: direction > 0 ? 96 : -96,
              y: 0,
              scale: 1,
            })
            .to(item, {
              x: 0,
              duration: 1.2,
              ease: "expo.out",
            });
          return;
        }

        const tl = gsap.timeline();
        tl.set(item, baseSet, 0);

        if (safeVariant === "fade-shrink") {
          tl.to(
            item,
            {
              x: next.x - w / 2,
              y: next.y - h / 2,
              duration: 0.9,
              ease: "expo.out",
            },
            0,
          )
            .to(item, { autoAlpha: 0, duration: 1, ease: "power1.out" }, 0.4)
            .to(item, { scale: 0.2, duration: 1, ease: "quint.out" }, 0.4);
        } else if (safeVariant === "zoom-fade") {
          tl.to(
            item,
            {
              x: next.x - w / 2,
              y: next.y - h / 2,
              duration: 1.8,
              ease: "expo.out",
            },
            0,
          )
            .to(item, { autoAlpha: 0, duration: 0.8, ease: "power1.out" }, 0.8)
            .to(item, { scale: 2, duration: 0.8, ease: "quint.inOut" }, 0.8);
        } else if (safeVariant === "drop") {
          tl.to(
            item,
            {
              x: next.x - w / 2,
              y: next.y - h / 2,
              duration: 1.6,
              ease: "expo.out",
            },
            0,
          )
            .to(item, { autoAlpha: 0, duration: 1, ease: "power1.out" }, 0.4)
            .to(
              item,
              {
                y: `+=${root.clientHeight + h / 2}`,
                duration: 1,
                ease: "quint.inOut",
              },
              0.4,
            );
        } else if (safeVariant === "scatter") {
          const scatterX = gsap.utils.random(-(root.clientWidth + w), root.clientWidth + w);
          const scatterY = gsap.utils.random(-(root.clientHeight + h), root.clientHeight + h);
          tl.to(
            item,
            {
              x: next.x - w / 2,
              y: next.y - h / 2,
              duration: 1.6,
              ease: "expo.out",
            },
            0,
          )
            .to(item, { autoAlpha: 0, duration: 0.8, ease: "power1.out" }, 0.6)
            .to(
              item,
              {
                x: `+=${scatterX}`,
                y: `+=${scatterY}`,
                rotate: gsap.utils.random(-40, 40),
                duration: 1,
                ease: "quint.out",
              },
              0.6,
            );
        } else {
          tl.set(
            item,
            {
              ...baseSet,
              x: next.x - w / 2,
              y: next.y - h / 2,
              transformOrigin: "50% -10%",
            },
            0,
          )
            .to(item, { autoAlpha: 0, duration: 0.5, ease: "power1.out" }, 0.4)
            .to(item, { scaleX: 0.5, scaleY: 2, duration: 0.2, ease: "quad.in" }, 0.4)
            .to(
              item,
              {
                scaleX: 0.7,
                scaleY: 1.7,
                y: `+=${gsap.utils.random(root.clientHeight / 2, root.clientHeight)}`,
                duration: 0.5,
                ease: "expo.out",
              },
              0.6,
            );
        }
      };

      const leave = () => {
        firstMove = true;
      };

      root.addEventListener("pointermove", show, { passive: true });
      root.addEventListener("pointerdown", show, { passive: true });
      root.addEventListener("pointerleave", leave);
      root.addEventListener("pointercancel", leave);

      return () => {
        root.removeEventListener("pointermove", show);
        root.removeEventListener("pointerdown", show);
        root.removeEventListener("pointerleave", leave);
        root.removeEventListener("pointercancel", leave);
      };
    }, root);

    return () => {
      root.dataset.imageTrail = "idle";
      ctx.revert();
    };
  }, [safeVariant, trailItems]);

  const customBackgroundColor =
    backgroundColor?.toLowerCase() !== VARIANT_THEME["fade-shrink"].bg
      ? backgroundColor
      : undefined;
  const stageStyle: React.CSSProperties = {
    color: useBackground ? theme.text : undefined,
  };
  const backgroundStyle: React.CSSProperties = {
    backgroundColor: useBackground ? customBackgroundColor || theme.bg : "transparent",
  };
  const isFullFrame = safeVariant === "full-frame";
  const titleStrokeColor = isFullFrame
    ? useBackground
      ? theme.title
      : "hsl(var(--foreground))"
    : theme.title;
  const titleStyle: React.CSSProperties = {
    color: "transparent",
    WebkitTextFillColor: "transparent",
    WebkitTextStroke: `2px ${titleStrokeColor}`,
    textShadow: useBackground ? "none" : "0 0 0 transparent",
    WebkitTextStrokeColor: titleStrokeColor,
    mixBlendMode: useBackground ? theme.blend : "normal",
  };
  const filter = theme.filter;

  if (trailItems.length === 0) {
    return <JustifiedGrid photos={photos} spacingClass="gap-2 md:gap-3" onOpen={onOpen} />;
  }

  return (
    <section
      ref={rootRef}
      className="group/image-trail relative min-h-[100svh] overflow-hidden text-[hsl(var(--foreground))]"
      data-image-trail="idle"
      data-image-trail-variant={safeVariant}
      style={stageStyle}
    >
      <div
        aria-hidden="true"
        data-image-trail-bg
        className="pointer-events-none absolute inset-0 z-0"
        style={backgroundStyle}
      />
      <div
        data-image-trail-layer
        className="pointer-events-none absolute inset-0 z-10 isolate overflow-hidden"
      >
        {trailItems.map(({ photo, url, fullUrl }, index) =>
          safeVariant === "full-frame" ? (
            <div
              key={`${photo.id}-${index}`}
              data-image-trail-item
              className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-0 will-change-transform"
              style={{ backgroundColor: useBackground ? photo.dominantColor ?? "transparent" : "transparent" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullUrl}
                alt=""
                decoding="async"
                loading={index === 0 ? "eager" : "lazy"}
                className="h-[82%] w-[86%] object-contain object-center"
              />
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${photo.id}-${index}`}
              src={url}
              alt=""
              decoding="async"
              loading="lazy"
              data-image-trail-item
              className="absolute left-0 top-0 aspect-[4/3] w-[clamp(9rem,38vw,16rem)] object-cover opacity-0 shadow-2xl will-change-transform sm:w-[clamp(12rem,24vw,20rem)]"
              style={{ backgroundColor: photo.dominantColor ?? "transparent", filter }}
            />
          ),
        )}
        <div className="grid min-h-[100svh] grid-rows-[auto_1fr_auto] px-5 py-5 md:px-8 md:py-8">
        <div className="relative z-30 grid gap-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div>
            <h1 className="text-base font-medium leading-none tracking-normal">
              {stageTitle}
            </h1>
            {subtitle && (
              <p className="mt-2 max-w-md text-sm opacity-75">{subtitle}</p>
            )}
          </div>
          <div className="min-w-0 justify-self-start text-[10px] uppercase tracking-[0.08em] opacity-75 md:justify-self-end md:text-right">
            <span className="block max-w-full truncate">
              Image trail / {safeVariant.replace("-", " ")}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center py-12 text-center">
          <h2
            className="pointer-events-none relative z-30 max-w-[12ch] text-[clamp(4rem,22vw,18rem)] font-black uppercase leading-[0.78] tracking-normal md:max-w-[9ch]"
            style={titleStyle}
          >
            {stageTitle}
          </h2>
        </div>

        <div className="relative z-30 flex items-end justify-between gap-4 text-xs uppercase tracking-[0.18em] opacity-75">
          <span>{photos.length} photos</span>
          <span>Move to reveal</span>
        </div>
      </div>
      </div>

      <div className="relative z-20 mt-10 px-5 pt-[100svh] md:hidden">
        <JustifiedGrid photos={photos} spacingClass="gap-2" onOpen={onOpen} />
      </div>
      <div className="relative z-20 mt-10 hidden px-5 pt-[100svh] group-data-[image-trail=idle]/image-trail:block md:px-8">
        <JustifiedGrid photos={photos} spacingClass="gap-2 md:gap-3" onOpen={onOpen} />
      </div>
    </section>
  );
}
