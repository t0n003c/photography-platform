"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import { JustifiedGrid } from "./grids";

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const BUCKETS = ["large", "medium", "small"];
const MAX_ITEMS = 24;

export type RotatingScrollVariant =
  | "demo1"
  | "demo2"
  | "demo3"
  | "demo4"
  | "demo5";

interface RotatingScrollProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  variant?: RotatingScrollVariant;
  useBackground?: boolean;
  backgroundColor?: string;
  marqueeText?: string;
  onOpen: (index: number) => void;
}

interface RotatingItem {
  photo: PhotoDTO;
  url: string;
  originalIndex: number;
}

interface VariantTheme {
  bg: string;
  text: string;
  marquee: string;
  blend: React.CSSProperties["mixBlendMode"];
  itemWidth: string;
  aspectRatio: string;
  marginBottom: string;
  borderRadius: string;
  mobileFontSize: string;
  desktopFontSize: string;
  fontFamily: string;
  fontWeight: number;
  fontVariationSettings?: string;
  fontStretch?: string;
}

const VARIANT_THEME: Record<RotatingScrollVariant, VariantTheme> = {
  demo1: {
    bg: "#141414",
    text: "#ffffffea",
    marquee: "rgb(190, 175, 110)",
    blend: "plus-lighter",
    itemWidth: "min(82vw, 600px)",
    aspectRatio: "14 / 9",
    marginBottom: "-5rem",
    borderRadius: "0px",
    mobileFontSize: "clamp(2rem, 16vw, 8rem)",
    desktopFontSize: "clamp(2rem, 8.5vw, 5.75rem)",
    fontFamily: '"scale-variable", var(--font-space-grotesk), var(--font-montserrat), system-ui, sans-serif',
    fontWeight: 800,
    fontVariationSettings: '"wght" 772, "wdth" 60',
    fontStretch: "condensed",
  },
  demo2: {
    bg: "#11150b",
    text: "rgb(144, 34, 34)",
    marquee: "rgb(231, 27, 27)",
    blend: "difference",
    itemWidth: "min(72vw, 300px)",
    aspectRatio: "4 / 5",
    marginBottom: "-5rem",
    borderRadius: "0px",
    mobileFontSize: "clamp(2rem, 16vw, 8rem)",
    desktopFontSize: "clamp(2rem, 9vw, 6rem)",
    fontFamily: '"totalblack-variable", "Arial Black", var(--font-montserrat), system-ui, sans-serif',
    fontWeight: 900,
    fontVariationSettings: '"wght" 800',
  },
  demo3: {
    bg: "#000000",
    text: "#ffffffea",
    marquee: "rgb(67, 67, 67)",
    blend: "difference",
    itemWidth: "min(72vw, 300px)",
    aspectRatio: "4 / 5",
    marginBottom: "-7rem",
    borderRadius: "7px",
    mobileFontSize: "clamp(2rem, 16vw, 5rem)",
    desktopFontSize: "clamp(2rem, 16vw, 5rem)",
    fontFamily: 'var(--font-space-grotesk), var(--font-montserrat), system-ui, sans-serif',
    fontWeight: 800,
  },
  demo4: {
    bg: "#ffffff",
    text: "#b69897",
    marquee: "rgb(233, 48, 29)",
    blend: "difference",
    itemWidth: "min(72vw, 300px)",
    aspectRatio: "4 / 5",
    marginBottom: "5rem",
    borderRadius: "7px",
    mobileFontSize: "clamp(2rem, 16vw, 14rem)",
    desktopFontSize: "clamp(2rem, 8vw, 7rem)",
    fontFamily: '"scale-variable", var(--font-space-grotesk), var(--font-montserrat), system-ui, sans-serif',
    fontWeight: 800,
    fontVariationSettings: '"wght" 772, "wdth" 60',
    fontStretch: "condensed",
  },
  demo5: {
    bg: "#141414",
    text: "#797979",
    marquee: "rgb(56, 56, 56)",
    blend: "plus-lighter",
    itemWidth: "min(72vw, 300px)",
    aspectRatio: "4 / 5",
    marginBottom: "-10rem",
    borderRadius: "0px",
    mobileFontSize: "clamp(2rem, 16vw, 3rem)",
    desktopFontSize: "clamp(2rem, 16vw, 3rem)",
    fontFamily: 'var(--font-space-grotesk), var(--font-montserrat), system-ui, sans-serif',
    fontWeight: 800,
  },
};

function pickUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function seeded(index: number, min: number, max: number) {
  const x = Math.sin(index * 999 + 41) * 10000;
  const unit = x - Math.floor(x);
  return min + unit * (max - min);
}

function marqueeWords(text: string | undefined, title?: string, subtitle?: string | null) {
  const raw = text?.trim() || [title, subtitle].filter(Boolean).join(" / ") || "Rotating on scroll";
  return raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function safeVariant(value: RotatingScrollVariant | undefined): RotatingScrollVariant {
  return value && VARIANT_THEME[value] ? value : "demo5";
}

function holdAtMiddle(progress: number, hold = 0.25) {
  const half = hold * 0.5;
  if (progress < 0.5 - half) {
    return gsap.utils.mapRange(0, 0.5 - half, 0, 0.5, progress);
  }
  if (progress > 0.5 + half) {
    return gsap.utils.mapRange(0.5 + half, 1, 0.5, 1, progress);
  }
  return 0.5;
}

/**
 * Codrops RotatingOnScrollAnimations adaptation. Intentional deviations:
 * Codrops creates its own Lenis instance and uses bundled demo images/text; this
 * component uses the app's global Lenis/ScrollTrigger integration, selected
 * gallery photos, and an SSR/reduced-motion static grid fallback.
 */
export function RotatingScroll({
  photos,
  title,
  subtitle,
  variant,
  useBackground = true,
  backgroundColor,
  marqueeText,
  onOpen,
}: RotatingScrollProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const selectedVariant = safeVariant(variant);
  const theme = VARIANT_THEME[selectedVariant];
  const items = React.useMemo<RotatingItem[]>(
    () =>
      photos
        .map((photo, originalIndex) => {
          const url = pickUrl(photo);
          return url ? { photo, url, originalIndex } : null;
        })
        .filter((item): item is RotatingItem => Boolean(item))
        .slice(0, MAX_ITEMS),
    [photos],
  );
  const words = React.useMemo(
    () => marqueeWords(marqueeText, title, subtitle),
    [marqueeText, title, subtitle],
  );
  const bg = useBackground ? (backgroundColor || theme.bg) : "transparent";

  useIso(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      root?.classList.add("is-reduced-motion");
      return () => root?.classList.remove("is-reduced-motion");
    }

    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("is-enhanced");

    const ctx = gsap.context(() => {
      const wraps = gsap.utils.toArray<HTMLElement>("[data-rotating-wrap]", root);
      const cards = gsap.utils.toArray<HTMLElement>("[data-rotating-card]", root);
      const marquee = root.querySelector<HTMLElement>("[data-rotating-marquee]");
      const isMobile = window.matchMedia("(max-width: 767px)").matches;

      const positionItems = () => {
        const amplitude =
          selectedVariant === "demo5"
            ? window.innerWidth * (isMobile ? 0.03 : 0.05)
            : selectedVariant === "demo3"
              ? 0
              : window.innerWidth * (isMobile ? 0.09 : 0.2);
        wraps.forEach((wrap, i) => {
          const angle =
            selectedVariant === "demo5"
              ? i * 0.9
              : selectedVariant === "demo4"
                ? i
                : i * 0.45;
          gsap.set(wrap, { x: Math.sin(angle) * amplitude });
        });
      };

      positionItems();

      cards.forEach((card, i) => {
        const setTransform = gsap.quickSetter(card, "css");
        const setFilter = gsap.quickSetter(card, "filter");
        const rx1 = seeded(i + 1, 70, 120);
        const rx2 = seeded(i + 2, 240, 290);
        const ry = seeded(i + 3, -20, 20);
        const rz = seeded(i + 4, -20, 20);
        const rz2 = seeded(i + 5, -50, 50);
        const rx4 = seeded(i + 6, -10, 10);
        const ry4 = seeded(i + 7, 200, 290);
        const rz4 = seeded(i + 8, -10, 10);
        const rx5 = seeded(i + 9, 130, 220);

        ScrollTrigger.create({
          trigger: card,
          start: "top bottom+=20%",
          end: "bottom top-=20%",
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate(self) {
            const p = self.progress;
            if (selectedVariant === "demo1") {
              setTransform({
                rotationX: gsap.utils.interpolate(rx1, -rx1, p),
                rotationY: gsap.utils.interpolate(ry, -ry, p),
                rotationZ: gsap.utils.interpolate(rz, -rz, p),
                z: Math.sin(p * Math.PI) * -50,
              });
              return;
            }
            if (selectedVariant === "demo2") {
              setTransform({
                rotationX: gsap.utils.interpolate(rx2, -rx2, p),
                rotationY: gsap.utils.interpolate(ry, -ry, p),
                rotationZ: gsap.utils.interpolate(rz2, -rz2, p),
                z: Math.pow(Math.sin(p * Math.PI), 4) * -300,
              });
              return;
            }
            if (selectedVariant === "demo3") {
              const cos = Math.cos(p * Math.PI);
              const sin = Math.sin(p * Math.PI);
              setTransform({
                rotationX: Math.sign(cos) * Math.pow(Math.abs(cos), 0.6) * 90,
                z: Math.pow(sin, 8) * -800,
                yPercent: 1 + Math.pow(cos, 2) * -40,
              });
              setFilter(`saturate(${Math.pow(sin, 3)}) brightness(${Math.pow(sin, 3)})`);
              return;
            }
            if (selectedVariant === "demo4") {
              setTransform({
                rotationX: gsap.utils.interpolate(rx4, -rx4, p),
                rotationY: gsap.utils.interpolate(ry4, -ry4, p),
                rotationZ: gsap.utils.interpolate(rz4, -rz4, p),
                z: Math.sin(p * Math.PI) * -150,
              });
              const velocityNorm = Math.min(Math.abs(self.getVelocity()) / 2500, 1);
              const blur = velocityNorm * 15;
              const saturation = 1 - velocityNorm;
              setFilter(`blur(${blur}px) saturate(${saturation})`);
              return;
            }

            const t = holdAtMiddle(p, 0.25);
            const cos = Math.cos(t * Math.PI);
            const sin = Math.sin(t * Math.PI);
            setTransform({
              scaleX: 1 + Math.pow(cos, 2) * 0.6,
              scaleY: 0.5 + Math.pow(sin, 2) * 0.5,
              rotationX: gsap.utils.interpolate(-rx5, rx5, t),
              rotationZ: gsap.utils.interpolate(50, -50, t),
              z: sin * -750,
            });
            setFilter(`blur(${Math.pow(cos, 2) * 12}px) brightness(${Math.pow(sin, 6)})`);
          },
        });
      });

      if (marquee) {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: root.querySelector("[data-rotating-gallery]"),
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          })
          .fromTo(marquee, { x: "100vw" }, { x: "-100%", ease: "none" });
      }

      const onResize = () => {
        positionItems();
        ScrollTrigger.refresh();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, root);

    return () => {
      ctx.revert();
      root.classList.remove("is-enhanced");
    };
  }, [selectedVariant, items.length]);

  if (items.length === 0) return null;

  return (
    <section
      ref={rootRef}
      className="rotating-scroll relative min-h-screen overflow-x-clip"
      data-rotating-scroll
      data-rotating-variant={selectedVariant}
      style={
        {
          "--rotating-bg": bg,
          "--rotating-text": theme.text,
          "--rotating-marquee": theme.marquee,
          "--rotating-blend": theme.blend,
          "--rotating-width": theme.itemWidth,
          "--rotating-ar": theme.aspectRatio,
          "--rotating-gap": theme.marginBottom,
          "--rotating-radius": theme.borderRadius,
          "--rotating-marquee-mobile-size": theme.mobileFontSize,
          "--rotating-marquee-desktop-size": theme.desktopFontSize,
          "--rotating-marquee-font": theme.fontFamily,
          "--rotating-marquee-weight": theme.fontWeight,
          "--rotating-marquee-variation": theme.fontVariationSettings ?? "normal",
          "--rotating-marquee-stretch": theme.fontStretch ?? "normal",
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(var(--rotating-shadow-in,rgba(0,0,0,0.2))_10%,var(--rotating-shadow-out,rgba(0,0,0,0.8))_80%)]" />
      <div
        className="pointer-events-none fixed inset-x-0 top-1/2 z-[4] w-screen -translate-y-1/2 overflow-hidden"
        style={{ mixBlendMode: theme.blend }}
      >
        <div
          data-rotating-marquee
          className="flex w-max gap-12 whitespace-nowrap will-change-transform"
        >
          {Array.from({ length: 4 }).flatMap((_, repeat) =>
            words.flatMap((word, i) => [
              <span
                key={`${repeat}-${i}-word`}
                className="text-[length:var(--rotating-marquee-mobile-size)] uppercase leading-none text-[var(--rotating-marquee)] md:text-[length:var(--rotating-marquee-desktop-size)]"
                style={{
                  fontFamily: "var(--rotating-marquee-font)",
                  fontVariationSettings: "var(--rotating-marquee-variation)",
                  fontStretch: "var(--rotating-marquee-stretch)",
                  fontWeight: "var(--rotating-marquee-weight)",
                }}
              >
                {word}
              </span>,
              <span
                key={`${repeat}-${i}-sep`}
                className="text-[length:var(--rotating-marquee-mobile-size)] uppercase leading-none text-[var(--rotating-marquee)] md:text-[length:var(--rotating-marquee-desktop-size)]"
                style={{
                  fontFamily: "var(--rotating-marquee-font)",
                  fontVariationSettings: "var(--rotating-marquee-variation)",
                  fontStretch: "var(--rotating-marquee-stretch)",
                  fontWeight: "var(--rotating-marquee-weight)",
                }}
              >
                /
              </span>,
            ]),
          )}
        </div>
      </div>

      <div
        className="relative z-[3] flex flex-col items-center bg-[var(--rotating-bg)] px-4 pb-[35vh] pt-[25vh] text-[var(--rotating-text)]"
        data-rotating-gallery
      >
        <div className="sr-only">
          <h2>{title || "Gallery"}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {items.map((item, i) => (
          <div
            key={`${item.photo.id}-${i}`}
            data-rotating-wrap
            className="w-full max-w-[var(--rotating-width)] [perspective:900px]"
            style={{ marginBottom: "var(--rotating-gap)" }}
          >
            <button
              type="button"
              data-rotating-card
              onClick={() => onOpen(item.originalIndex)}
              className="block w-full overflow-hidden rounded-[var(--rotating-radius)] bg-cover bg-center bg-no-repeat shadow-none outline-none [aspect-ratio:var(--rotating-ar)] [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              style={{ backgroundImage: `url(${item.url})` }}
              aria-label={`Open photo ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <div className="rotating-scroll-fallback hidden px-4 py-12">
        <JustifiedGrid
          photos={items.map((item) => item.photo)}
          spacingClass="gap-2 md:gap-3"
          onOpen={(index) => onOpen(items[index]?.originalIndex ?? index)}
        />
      </div>
    </section>
  );
}
