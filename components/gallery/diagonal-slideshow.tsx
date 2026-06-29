"use client";

import * as React from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, MoveLeft, X } from "lucide-react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";
import { prefersReducedMotion } from "@/components/webgl/feature";
import { JustifiedGrid } from "./grids";

const useIso = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

const BUCKETS = ["large", "medium", "small"];
const CHARS = "$%#&=*abcdefghijklmnopqrstuvwxyz.:,^".split("");
const MIN_SLIDES = 4;
const MAX_SLIDES = 24;

interface DiagonalItem {
  photo: PhotoDTO;
  url: string;
  originalIndex: number;
}

interface DiagonalSlideshowProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  useBackground?: boolean;
  backgroundColor?: string;
  textColor?: string;
  decoColor?: string;
  sideText?: string;
  showSideText?: boolean;
  showDetail?: boolean;
  onOpen: (index: number) => void;
}

function pickUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function titleFor(photo: PhotoDTO, fallback: string) {
  return photo.headline?.trim() || photo.altText?.trim() || fallback;
}

function subtitleFor(photo: PhotoDTO, fallback?: string | null) {
  return photo.subhead?.trim() || fallback?.trim() || "";
}

function photoDetailText(photo: PhotoDTO) {
  return {
    headline: photo.headline?.trim() || "Untitled photograph",
    subhead: photo.subhead?.trim() || "",
    caption: photo.caption?.trim() || "",
  };
}

function sideFor(photo: PhotoDTO, fallback: string, index: number) {
  return (
    photo.subhead?.trim() ||
    fallback.trim() ||
    photo.headline?.trim() ||
    photo.altText?.trim() ||
    `Frame ${index + 1}`
  );
}

function relativeIndex(index: number, current: number, total: number) {
  let diff = (index - current + total) % total;
  if (diff > total / 2) diff -= total;
  return diff;
}

function splitText(text: string) {
  return Array.from(text || " ");
}

function scrambledLetters(text: string, tick: number) {
  if (tick <= 0) return splitText(text);
  return splitText(text).map((char, index) => {
    if (char === " ") return " ";
    const settle = Math.floor((index + 1) * 1.8);
    if (tick > settle) return char;
    return CHARS[(index * 7 + tick * 5) % CHARS.length] ?? char;
  });
}

function slideStyle(
  diff: number,
  isOpen: boolean,
  isCurrent: boolean,
  isMobile: boolean,
): React.CSSProperties {
  const sideX = isMobile ? "34vw" : "41vw";
  const sideY = isMobile ? "18vh" : "23vh";
  const offX = isMobile ? "78vw" : "82vw";
  const offY = isMobile ? "72vh" : "86vh";
  const openX = isMobile ? "0vw" : "-28vw";
  const visible = isCurrent || Math.abs(diff) === 1 || isOpen;
  if (isOpen) {
    if (isCurrent) {
      return {
        transform: `translate(calc(-50% + ${openX}), -50%) rotate(0deg)`,
        opacity: 1,
      };
    }
    if (diff < 0) {
      return {
        transform: `translate(calc(-50% - ${offX}), calc(-50% - ${offY})) rotate(-30deg)`,
        opacity: 1,
      };
    }
    if (diff > 0) {
      return {
        transform: `translate(calc(-50% + ${offX}), calc(-50% + ${offY})) rotate(30deg)`,
        opacity: 1,
      };
    }
    return { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 0 };
  }
  if (diff === 0) {
    return { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 };
  }
  if (diff === 1) {
    return {
      transform: `translate(calc(-50% + ${sideX}), calc(-50% + ${sideY})) rotate(0deg)`,
      opacity: 1,
    };
  }
  if (diff === -1) {
    return {
      transform: `translate(calc(-50% - ${sideX}), calc(-50% - ${sideY})) rotate(0deg)`,
      opacity: 1,
    };
  }
  if (diff > 0) {
    return {
      transform: `translate(calc(-50% + ${offX}), calc(-50% + ${offY})) rotate(30deg)`,
      opacity: 0,
    };
  }
  return {
    transform: `translate(calc(-50% - ${offX}), calc(-50% - ${offY})) rotate(-30deg)`,
    opacity: visible ? 1 : 0,
  };
}

/**
 * Codrops DiagonalSlideshow adaptation. Intentional deviations: Codrops uses
 * TweenMax + Charming and demo copy; this component uses React state, modern
 * GSAP for tilt/detail fades, selected gallery photos, and a static reduced
 * motion fallback.
 */
export function DiagonalSlideshow({
  photos,
  title,
  subtitle,
  useBackground = true,
  backgroundColor = "#0c0c0c",
  textColor = "#f1f1f1",
  decoColor = "#141414",
  sideText = "",
  showSideText = true,
  showDetail = true,
  onOpen,
}: DiagonalSlideshowProps) {
  const rootRef = React.useRef<HTMLElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const imageRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const textRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [current, setCurrent] = React.useState(0);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [scrambleTick, setScrambleTick] = React.useState(999);
  const [isReduced, setIsReduced] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  const items = React.useMemo<DiagonalItem[]>(
    () =>
      photos
        .map((photo, originalIndex) => {
          const url = pickUrl(photo);
          return url ? { photo, url, originalIndex } : null;
        })
        .filter((item): item is DiagonalItem => Boolean(item))
        .slice(0, MAX_SLIDES),
    [photos],
  );
  const active = items[current] ?? items[0];
  const activeId = active?.photo.id;
  const activeDetail = active ? photoDetailText(active.photo) : null;
  const bg = useBackground ? backgroundColor : "transparent";

  const navigate = React.useCallback(
    (direction: "next" | "prev") => {
      if (isAnimating || isOpen || items.length < 2) return;
      setIsAnimating(true);
      setCurrent((value) =>
        direction === "next"
          ? (value + 1) % items.length
          : (value - 1 + items.length) % items.length,
      );
      window.setTimeout(() => setIsAnimating(false), 860);
    },
    [isAnimating, isOpen, items.length],
  );

  React.useEffect(() => {
    if (!activeId || isReduced) return;
    setScrambleTick(0);
    const id = window.setInterval(() => {
      setScrambleTick((tick) => {
        if (tick >= 28) {
          window.clearInterval(id);
          return 999;
        }
        return tick + 1;
      });
    }, 32);
    return () => window.clearInterval(id);
  }, [activeId, isReduced]);

  useIso(() => {
    const root = rootRef.current;
    if (!root) return;
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const setMobile = () => setIsMobile(mobileQuery.matches);
    setMobile();
    mobileQuery.addEventListener("change", setMobile);
    if (prefersReducedMotion() || items.length < MIN_SLIDES) {
      setIsReduced(true);
      return () => mobileQuery.removeEventListener("change", setMobile);
    }

    const ctx = gsap.context(() => {
      const stage = stageRef.current;
      if (!stage) return;
      const media = window.matchMedia("(pointer: fine)");

      const onMove = (event: PointerEvent) => {
        if (!media.matches || isOpen) return;
        const button = imageRefs.current[current];
        const text = textRefs.current[current];
        if (!button) return;
        const rect = button.getBoundingClientRect();
        const relX = (event.clientX - rect.left) / rect.width;
        const relY = (event.clientY - rect.top) / rect.height;
        const tx = -20 + relX * 40;
        const ty = -20 + relY * 40;
        const rx = -15 + relY * 30;
        const ry = -15 + relX * 30;
        gsap.to(button, {
          x: tx,
          y: ty,
          rotationX: rx,
          rotationY: ry,
          scale: 1.04,
          duration: 1.5,
          ease: "power1.out",
        });
        if (text) {
          gsap.to(text, {
            x: -tx,
            y: -ty,
            duration: 1.5,
            ease: "power1.out",
          });
        }
      };

      const resetTilt = () => {
        const button = imageRefs.current[current];
        const text = textRefs.current[current];
        gsap.to([button, text].filter(Boolean), {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          duration: 1.2,
          ease: "power4.out",
        });
      };

      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerleave", resetTilt);
      return () => {
        stage.removeEventListener("pointermove", onMove);
        stage.removeEventListener("pointerleave", resetTilt);
      };
    }, root);

    return () => {
      mobileQuery.removeEventListener("change", setMobile);
      ctx.revert();
    };
  }, [current, isOpen, items.length]);

  React.useEffect(() => {
    if (!contentRef.current || isReduced) return;
    const targets = contentRef.current.querySelectorAll("[data-diagonal-content-part]");
    gsap.killTweensOf(targets);
    if (isOpen) {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 40 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          stagger: 0.05,
          delay: 0.28,
          ease: "power4.out",
        },
      );
    } else {
      gsap.to(targets, {
        opacity: 0,
        y: 10,
        duration: 0.28,
        stagger: 0.01,
        ease: "power3.in",
      });
    }
  }, [isOpen, current, isReduced]);

  if (items.length === 0) return null;

  if (isReduced || items.length < MIN_SLIDES) {
    return (
      <div className="px-4 py-12">
        <JustifiedGrid
          photos={items.map((item) => item.photo)}
          spacingClass="gap-2 md:gap-3"
          onOpen={(index) => onOpen(items[index]?.originalIndex ?? index)}
        />
      </div>
    );
  }

  return (
    <section
      ref={rootRef}
      className="relative left-1/2 h-[calc(100svh-4rem)] min-h-[620px] w-screen -translate-x-1/2 overflow-hidden text-[var(--diagonal-text)] md:h-[calc(100svh-4rem)] md:min-h-[720px]"
      data-diagonal-slideshow
      style={
        {
          "--diagonal-bg": bg,
          "--diagonal-text": textColor,
          "--diagonal-deco": decoColor,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 bg-[var(--diagonal-bg)]" />
      <div
        ref={stageRef}
        className={cn(
          "relative h-full w-full [perspective:1000px]",
          isOpen && "pointer-events-none",
        )}
      >
        <div
          className={cn(
            "absolute left-1/2 top-1/2 h-[58svh] w-[68vw] -translate-x-1/2 -translate-y-1/2 bg-[var(--diagonal-deco)] transition duration-[800ms] ease-[cubic-bezier(0.77,0,0.175,1)] md:h-[80vh] md:w-[27vw]",
            isOpen && "scale-x-[3.75] scale-y-[1.35] translate-x-[-52%] translate-y-[-47%]",
          )}
        />

        {items.map((item, index) => {
          const diff = relativeIndex(index, current, items.length);
          const isCurrent = diff === 0;
          const positionStyle = slideStyle(diff, isOpen, isCurrent, isMobile);
          const itemTitle = titleFor(item.photo, title || `Slide ${index + 1}`);
          const itemSubtitle = subtitleFor(item.photo, subtitle);
          const itemSide = sideFor(item.photo, sideText, index);
          const titleLetters =
            isCurrent && !isOpen
              ? scrambledLetters(itemTitle, scrambleTick)
              : splitText(itemTitle);
          const sideLetters =
            isCurrent && !isOpen
              ? scrambledLetters(itemSide, scrambleTick)
              : splitText(itemSide);

          return (
            <article
              key={item.photo.id}
              className={cn(
                "absolute left-1/2 top-1/2 z-20 flex h-[54svh] w-[62vw] flex-col justify-between transition-[opacity,transform] duration-[800ms] ease-[cubic-bezier(0.77,0,0.175,1)] [transform-style:preserve-3d] md:h-[80vh] md:w-[27vw]",
                Math.abs(diff) > 1 && "pointer-events-none",
              )}
              style={positionStyle}
              aria-hidden={Math.abs(diff) > 1}
            >
              <button
                ref={(node) => {
                  imageRefs.current[index] = node;
                }}
                type="button"
                onClick={() => {
                  if (diff === 1) navigate("next");
                  else if (diff === -1) navigate("prev");
                  else if (showDetail) setIsOpen(true);
                  else onOpen(item.originalIndex);
                }}
                className={cn(
                  "absolute left-0 top-[8%] z-20 h-[78%] w-full overflow-hidden bg-cover bg-center outline-none [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black md:top-[10%] md:h-[80%]",
                  isCurrent ? "cursor-pointer" : "cursor-pointer",
                )}
                style={{ backgroundImage: `url(${item.url})` }}
                aria-label={
                  diff === 0
                    ? showDetail
                      ? `Open ${itemTitle}`
                      : `View ${itemTitle}`
                    : diff > 0
                      ? "Next slide"
                      : "Previous slide"
                }
              />

              <div
                ref={(node) => {
                  textRefs.current[index] = node;
                }}
                className={cn(
                  "pointer-events-none relative z-30 hidden h-full flex-col justify-between pl-0 pt-[2vh] md:flex",
                  !isCurrent && "opacity-0",
                  isOpen && "opacity-0",
                )}
              >
                {showSideText && (
                  <p className="ml-[-1.85rem] max-h-[38vh] origin-center rotate-180 text-sm leading-none text-white/35 [writing-mode:vertical-rl]">
                    {sideLetters.map((char, i) => (
                      <span key={`${item.photo.id}-side-${i}`}>{char}</span>
                    ))}
                  </p>
                )}
                <div className="mb-[1vh] ml-[-1.85rem]">
                  <span className="mb-2 block text-2xl font-bold before:mr-3 before:content-['-']">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-[clamp(2.5rem,3.25vw,4.5rem)] font-medium leading-[0.9]">
                    {titleLetters.map((char, i) => (
                      <span key={`${item.photo.id}-title-${i}`}>{char}</span>
                    ))}
                  </h2>
                  {itemSubtitle && (
                    <p className="mt-2 max-w-[18rem] text-sm leading-snug opacity-85">
                      {itemSubtitle}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        <button
          type="button"
          onClick={() => navigate("prev")}
          disabled={isAnimating || isOpen}
          className={cn(
            "absolute left-4 top-4 z-40 flex h-12 w-12 items-center justify-center border-0 bg-transparent text-white transition duration-500 hover:scale-110 disabled:pointer-events-none disabled:opacity-0 md:left-[calc(36.5%-1.5rem)] md:top-[calc(10vh+0.75rem)]",
          )}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-10 w-10 rotate-45" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={() => navigate("next")}
          disabled={isAnimating || isOpen}
          className="absolute bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center border-0 bg-transparent text-white transition duration-500 hover:scale-110 disabled:pointer-events-none disabled:opacity-0 md:bottom-[calc(10vh+0.75rem)] md:right-[calc(36.5%-1.5rem)]"
          aria-label="Next slide"
        >
          <ChevronRight className="h-10 w-10 rotate-45" strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={contentRef}
        className={cn(
          "pointer-events-none absolute inset-0 z-50 overflow-auto px-6 py-12 transition-opacity duration-300 md:left-[49.5%] md:right-[7.5%] md:px-0 md:py-[calc(10vh+5rem)]",
          isOpen && "pointer-events-auto",
        )}
      >
        {active && (
          <div
            className={cn(
              "ml-auto max-w-3xl text-[var(--diagonal-text)]",
              !isOpen && "sr-only",
            )}
          >
            <button
              type="button"
              data-diagonal-content-part
              onClick={() => setIsOpen(false)}
              className="mb-8 flex h-10 w-16 items-center justify-start opacity-0"
              aria-label="Close details"
            >
              <MoveLeft className="hidden h-10 w-10 md:block" strokeWidth={1.5} />
              <X className="h-8 w-8 md:hidden" strokeWidth={1.5} />
            </button>
            <span
              data-diagonal-content-part
              className="block text-2xl font-bold opacity-0 before:mr-3 before:content-['-'] md:absolute md:bottom-[7vh] md:right-0"
            >
              {String(current + 1).padStart(2, "0")}
            </span>
            <h2
              data-diagonal-content-part
              className="mt-4 text-[clamp(3rem,8vw,8rem)] font-medium leading-none opacity-0"
            >
              {activeDetail?.headline}
            </h2>
            {activeDetail?.subhead && (
              <p
                data-diagonal-content-part
                className="mt-4 max-w-xl text-lg opacity-0"
              >
                {activeDetail.subhead}
              </p>
            )}
            {activeDetail?.caption && (
              <p
                data-diagonal-content-part
                className="mt-8 max-w-3xl text-sm leading-7 opacity-0 md:columns-2 md:gap-8 md:text-justify"
              >
                {activeDetail.caption}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
