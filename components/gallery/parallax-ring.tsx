"use client";

import * as React from "react";
import gsap from "gsap";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { prefersReducedMotion } from "@/components/webgl/feature";
import { ResponsiveImage } from "./responsive-image";

const BUCKETS = ["large", "medium", "small"];
const CLICK_ANGLE = 112;
const MAX_RING_SLOTS = 10;
const SHARED_GUTTER_PX = 18;
const GUTTER_MASK_PX = SHARED_GUTTER_PX / 2;
const IMAGE_UNDERLAP_PX = 72;
const PARALLAX_REVEAL_PX = 24;
const MASK_REVEAL_PX = GUTTER_MASK_PX;
const PARALLAX_DRAG_FACTOR = 0.9;
const MOBILE_DRAG_MULTIPLIER = 1.8;

interface RingItem {
  photo: PhotoDTO;
  originalIndex: number;
  url: string;
}

function pickUrl(photo: PhotoDTO): string | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) return match.url;
  }
  return webp[0]?.url ?? photo.variants[0]?.url ?? null;
}

function getViewerAngle(rotation: number, index: number, step: number) {
  return gsap.utils.wrap(-180, 180, rotation - index * step);
}

function StaticFallback({
  photos,
  onOpen,
  className = "",
}: {
  photos: PhotoDTO[];
  onOpen: (index: number) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-3 overflow-x-auto bg-black p-4 [scrollbar-width:thin] ${className}`}>
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(index)}
          className="block aspect-[3/4] h-72 shrink-0 overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ResponsiveImage photo={photo} sizes="40vw" className="h-full w-full" />
        </button>
      ))}
    </div>
  );
}

export function ParallaxRing({
  photos,
  title,
  subtitle,
  onOpen,
}: {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  onOpen: (index: number) => void;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const floatRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const imageRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const leftMaskRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const rightMaskRefs = React.useRef<(HTMLSpanElement | null)[]>([]);
  const [enhanced, setEnhanced] = React.useState(false);

  const dragStart = React.useRef(0);
  const dragOrigin = React.useRef(0);
  const moved = React.useRef(0);
  const rotation = React.useRef(0);
  const parallaxOffset = React.useRef(0);
  const dragging = React.useRef(false);
  const startedInScene = React.useRef(false);
  const virtualStepRef = React.useRef(0);
  const nextForwardIndexRef = React.useRef(0);
  const nextBackwardIndexRef = React.useRef(0);
  const slotPhotoIndexesRef = React.useRef<number[]>([]);
  const [slotPhotoIndexes, setSlotPhotoIndexes] = React.useState<number[]>([]);

  const fallbackPhotos = React.useMemo(
    () => photos.filter((photo) => pickUrl(photo)),
    [photos],
  );
  const ringItems = React.useMemo<RingItem[]>(() => {
    const usable = photos
      .map((photo, originalIndex) => ({ photo, originalIndex, url: pickUrl(photo) }))
      .filter((item): item is RingItem => Boolean(item.url));
    if (usable.length === 0) return [];
    return usable;
  }, [photos]);
  const ringSlots = React.useMemo(
    () => Array.from({ length: Math.min(MAX_RING_SLOTS, ringItems.length) }, (_, index) => index),
    [ringItems.length],
  );

  React.useEffect(() => {
    const initialIndexes = ringSlots.map((slotIndex) => slotIndex);
    slotPhotoIndexesRef.current = initialIndexes;
    setSlotPhotoIndexes(initialIndexes);
    virtualStepRef.current = 0;
    nextForwardIndexRef.current = ringSlots.length;
    nextBackwardIndexRef.current = ringItems.length - 1;
  }, [ringItems.length, ringSlots]);

  React.useEffect(() => {
    if (prefersReducedMotion()) return;
    setEnhanced(true);
  }, []);

  React.useLayoutEffect(() => {
    if (!enhanced) return;
    const root = rootRef.current;
    const ring = ringRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLButtonElement[];
    const floats = floatRefs.current.filter(Boolean) as HTMLSpanElement[];
    const images = imageRefs.current.filter(Boolean) as HTMLSpanElement[];
    const leftMasks = leftMaskRefs.current.filter(Boolean) as HTMLSpanElement[];
    const rightMasks = rightMaskRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (
      !root ||
      !ring ||
      cards.length === 0 ||
      floats.length === 0 ||
      images.length === 0 ||
      leftMasks.length === 0 ||
      rightMasks.length === 0
    )
      return;

    const step = 360 / cards.length;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const baseRadius = Math.min(Math.max(root.clientWidth * 0.31, 360), 620);
    const radius = coarsePointer
      ? Math.min(Math.max(root.clientWidth * 0.48, 220), 360)
      : baseRadius;
    const dragMultiplier = coarsePointer ? MOBILE_DRAG_MULTIPLIER : 1;
    rotation.current = 0;
    parallaxOffset.current = 0;
    virtualStepRef.current = 0;
    nextForwardIndexRef.current = cards.length;
    nextBackwardIndexRef.current = ringItems.length - 1;
    gsap.set(ring, { rotationY: rotation.current, cursor: "grab" });
    const getRenderedRotation = () => Number(gsap.getProperty(ring, "rotationY")) || 0;
    const getClosestProminentIndex = (clientX: number, clientY: number) => {
      const renderedRotation = getRenderedRotation();
      return cards
        .map((card, index) => {
          const angle = Math.abs(getViewerAngle(renderedRotation, index, step));
          const rect = cards[index].getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          return {
            index,
            distance: Math.hypot(clientX - x, clientY - y),
            angle,
          };
        })
        .filter((item) => item.angle <= CLICK_ANGLE)
        .sort((a, b) => a.distance - b.distance || a.angle - b.angle)[0]?.index;
    };
    const updateCards = () => {
      const renderedRotation = getRenderedRotation();
      if (ringItems.length > cards.length) {
        const nextStep = Math.trunc(renderedRotation / step);
        let stepDelta = nextStep - virtualStepRef.current;
        if (stepDelta !== 0) {
          const direction = Math.sign(stepDelta);
          const nextIndexes = [...slotPhotoIndexesRef.current];

          while (stepDelta !== 0) {
            const candidateStep = virtualStepRef.current + direction;
            const rotationForHiddenSlot = candidateStep * step;
            const hiddenSlot = cards
              .map((_, index) => ({
                index,
                backness: Math.abs(getViewerAngle(rotationForHiddenSlot, index, step)),
              }))
              .sort((a, b) => b.backness - a.backness)[0]?.index;
            if (typeof hiddenSlot !== "number") break;
            const nextPhotoIndex =
              direction > 0
                ? gsap.utils.wrap(0, ringItems.length, nextForwardIndexRef.current++)
                : gsap.utils.wrap(0, ringItems.length, nextBackwardIndexRef.current--);
            nextIndexes[hiddenSlot] = nextPhotoIndex;
            virtualStepRef.current = candidateStep;
            stepDelta -= direction;
          }

          slotPhotoIndexesRef.current = nextIndexes;
          setSlotPhotoIndexes(nextIndexes);
        }
      }
      cards.forEach((card, index) => {
        const angle = Math.abs(getViewerAngle(renderedRotation, index, step));
        const image = images[index];
        const leftMask = leftMasks[index];
        const rightMask = rightMasks[index];
        const parallaxX = gsap.utils.clamp(
          -PARALLAX_REVEAL_PX,
          PARALLAX_REVEAL_PX,
          parallaxOffset.current,
        );
        const maskProgress = gsap.utils.clamp(-1, 1, parallaxX / PARALLAX_REVEAL_PX);
        const revealLeft = Math.max(-maskProgress, 0) * MASK_REVEAL_PX;
        const revealRight = Math.max(maskProgress, 0) * MASK_REVEAL_PX;
        card.style.zIndex = String(Math.round(1000 - angle));
        card.style.pointerEvents = angle <= CLICK_ANGLE ? "auto" : "none";
        gsap.set(image, { xPercent: -50, x: parallaxX, scale: 1 });
        gsap.set(leftMask, { width: GUTTER_MASK_PX - revealLeft + revealRight });
        gsap.set(rightMask, { width: GUTTER_MASK_PX - revealRight + revealLeft });
        gsap.set(card, { autoAlpha: 1 });
      });
    };
    cards.forEach((card, index) => {
      card.style.transform = `translateZ(${-radius}px) rotateY(${index * -step}deg)`;
      card.style.transformOrigin = `50% 50% ${radius}px`;
      card.style.backfaceVisibility = "hidden";
      card.style.opacity = "1";
      card.style.visibility = "visible";
    });
    updateCards();
    const entranceFloats = cards
      .map((card, index) => ({
        float: floats[index],
        left: card.getBoundingClientRect().left,
      }))
      .sort((a, b) => a.left - b.left)
      .map((item) => item.float);
    gsap.fromTo(
      entranceFloats,
      { y: 170, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 1.35,
        stagger: 0.065,
        ease: "expo.out",
        onComplete: updateCards,
      },
    );

    const updateParallax = () => {
      updateCards();
    };

    const drag = (clientX: number) => {
      const dx = Math.round(clientX) - dragStart.current;
      const totalDx = Math.round(clientX) - dragOrigin.current;
      const weightedDx = dx * dragMultiplier;
      moved.current += Math.abs(dx);
      rotation.current -= weightedDx % 360;
      parallaxOffset.current = gsap.utils.clamp(
        -PARALLAX_REVEAL_PX,
        PARALLAX_REVEAL_PX,
        -totalDx * PARALLAX_DRAG_FACTOR,
      );
      gsap.killTweensOf(parallaxOffset);
      gsap.killTweensOf(ring);
      gsap.to(ring, {
        rotationY: rotation.current,
        duration: 0.42,
        ease: "power3.out",
        onUpdate: updateParallax,
      });
      dragStart.current = Math.round(clientX);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      drag(event.clientX);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      gsap.set(ring, { cursor: "grab" });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      gsap.to(parallaxOffset, {
        current: 0,
        duration: 0.5,
        ease: "power3.out",
        onUpdate: updateCards,
      });
      if (startedInScene.current && moved.current < 8) {
        const index = getClosestProminentIndex(event.clientX, event.clientY);
        if (typeof index === "number") onOpen(ringItems[index].originalIndex);
      }
      startedInScene.current = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      const scene = sceneRef.current;
      const rect = scene?.getBoundingClientRect();
      startedInScene.current = Boolean(
        rect &&
          event.clientX >= rect.left - radius &&
          event.clientX <= rect.right + radius &&
          event.clientY >= rect.top - 80 &&
          event.clientY <= rect.bottom + 80,
      );
      if (!startedInScene.current) return;
      dragging.current = true;
      moved.current = 0;
      dragStart.current = Math.round(event.clientX);
      dragOrigin.current = Math.round(event.clientX);
      gsap.set(ring, { cursor: "grabbing" });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };
    root.addEventListener("pointerdown", onPointerDown);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [enhanced, onOpen, ringItems]);

  if (ringItems.length === 0) {
    return <StaticFallback photos={fallbackPhotos} onOpen={onOpen} />;
  }

  return (
    <>
      <StaticFallback photos={fallbackPhotos} onOpen={onOpen} className="pr-fallback" />
      <section
        ref={rootRef}
        className={`pr-root relative h-[100svh] min-h-[620px] w-full touch-pan-y overflow-hidden bg-black text-white [transform-style:preserve-3d] [user-select:none] ${enhanced ? "is-enhanced" : ""}`}
      >
        <div className="pointer-events-none absolute left-5 top-5 z-10 max-w-[min(28rem,calc(100vw-2.5rem))] sm:left-8 sm:top-8">
          {title && (
            <h2 className="font-serif text-4xl italic leading-none tracking-normal sm:text-6xl">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-3 max-w-md text-sm uppercase tracking-[0.12em] text-white/70">
              {subtitle}
            </p>
          )}
        </div>
        <div
          ref={sceneRef}
          className="absolute left-1/2 top-1/2 h-[min(62vh,440px)] w-[min(46vw,330px)] -translate-x-1/2 -translate-y-1/2 [perspective:2000px]"
        >
          <div ref={ringRef} className="absolute inset-0 [transform-style:preserve-3d]">
            {ringSlots.map((slotIndex) => {
              const itemIndex = slotPhotoIndexes[slotIndex] ?? slotIndex;
              const item = ringItems[itemIndex % ringItems.length];
              return (
                <button
                  key={`ring-slot-${slotIndex}`}
                  ref={(el) => {
                    cardRefs.current[slotIndex] = el;
                  }}
                  type="button"
                  aria-label={`View ${item.photo.altText || "photo"}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (moved.current < 8) onOpen(item.originalIndex);
                  }}
                  className="absolute inset-0 overflow-hidden rounded-md shadow-2xl will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span
                    ref={(el) => {
                      floatRefs.current[slotIndex] = el;
                    }}
                    className="absolute inset-0 overflow-hidden bg-black"
                  >
                    <span
                      ref={(el) => {
                        imageRefs.current[slotIndex] = el;
                      }}
                      className="absolute inset-y-0 left-1/2 bg-cover bg-center will-change-transform"
                      style={{
                        backgroundImage: `url(${item.url})`,
                        width: `calc(100% + ${IMAGE_UNDERLAP_PX}px)`,
                      }}
                    />
                    <span
                      ref={(el) => {
                        leftMaskRefs.current[slotIndex] = el;
                      }}
                      className="absolute inset-y-0 left-0 z-10 bg-black"
                      style={{ width: GUTTER_MASK_PX }}
                    />
                    <span
                      ref={(el) => {
                        rightMaskRefs.current[slotIndex] = el;
                      }}
                      className="absolute inset-y-0 right-0 z-10 bg-black"
                      style={{ width: GUTTER_MASK_PX }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="pointer-events-none absolute bottom-5 left-5 z-10 text-xs uppercase tracking-[0.16em] text-white/55 sm:left-8">
          Drag to rotate
        </p>
      </section>
    </>
  );
}
