"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronsLeftRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";

type ImageComparisonBlockData = Extract<LeafBlock, { type: "imageComparison" }>;

type CSSPropertiesWithVars = CSSProperties & {
  [key: `--${string}`]: string | number | undefined;
};

const ASPECT_CLASS: Record<
  NonNullable<ImageComparisonBlockData["aspectRatio"]>,
  string
> = {
  "16-9": "aspect-video",
  "4-3": "aspect-[4/3]",
  square: "aspect-square",
  portrait: "aspect-[4/5]",
};

const WIDTH_CLASS: Record<
  NonNullable<ImageComparisonBlockData["width"]>,
  string
> = {
  normal: "max-w-3xl",
  wide: "max-w-5xl",
  full: "max-w-none",
};

function clampPosition(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.min(95, Math.max(5, value));
}

function selectedPhoto(photoId: string | null | undefined, photoMap: Map<string, PhotoDTO>) {
  return photoId ? photoMap.get(photoId) : undefined;
}

function ComparisonImage({
  photo,
  label,
  missingLabel,
  priority,
}: {
  photo?: PhotoDTO;
  label: string;
  missingLabel: string;
  priority?: boolean;
}) {
  if (!photo) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted))] text-sm text-[hsl(var(--muted-foreground))]">
        {missingLabel}
      </div>
    );
  }

  return (
    <>
      <ResponsiveImage
        photo={photo}
        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 88vw, 1180px"
        priority={priority}
        className="h-full w-full"
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

export function ImageComparisonBlock({
  block,
  photoMap,
  preview = false,
}: {
  block: ImageComparisonBlockData;
  photoMap: Map<string, PhotoDTO>;
  preview?: boolean;
}) {
  const leftPhoto = selectedPhoto(block.leftPhotoId, photoMap);
  const rightPhoto = selectedPhoto(block.rightPhotoId, photoMap);
  const hasBothPhotos = Boolean(leftPhoto && rightPhoto);
  const [position, setPosition] = useState(() =>
    clampPosition(block.initialPosition ?? 50),
  );
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPosition(clampPosition(block.initialPosition ?? 50));
  }, [block.initialPosition]);

  const setPositionFromClientX = useCallback((clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    setPosition(clampPosition(((clientX - rect.left) / rect.width) * 100));
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      const isHandle = Boolean(target.closest("[data-comparison-handle]"));
      if (event.pointerType !== "mouse" && !isHandle) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      setPositionFromClientX(event.clientX);
    },
    [setPositionFromClientX],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      setPositionFromClientX(event.clientX);
    },
    [dragging, setPositionFromClientX],
  );

  const endDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setPosition((current) => clampPosition(current - (event.shiftKey ? 10 : 2)));
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setPosition((current) => clampPosition(current + (event.shiftKey ? 10 : 2)));
    }
    if (event.key === "Home") {
      event.preventDefault();
      setPosition(5);
    }
    if (event.key === "End") {
      event.preventDefault();
      setPosition(95);
    }
  }, []);

  if (!hasBothPhotos && !preview) return null;

  const leftLabel = block.leftLabel?.trim() || "Before";
  const rightLabel = block.rightLabel?.trim() || "After";
  const panelStyle = {
    "--image-comparison-bg": block.backgroundColor || "#f4f4f5",
    "--image-comparison-handle": block.handleColor || "#ffffff",
  } as CSSPropertiesWithVars;

  return (
    <section className="image-comparison-block bg-[hsl(var(--background))] py-14 text-[hsl(var(--foreground))] sm:py-20">
      <Container>
        <div
          className={cn(
            "image-comparison-shell mx-auto",
            block.showcaseBackground !== false
              ? "image-comparison-shell--panel rounded-[1.5rem] p-3 sm:p-5"
              : "image-comparison-shell--plain",
            WIDTH_CLASS[block.width ?? "wide"],
          )}
          style={panelStyle}
        >
          {(block.title || block.subtitle) && (
            <div className="mx-auto mb-6 max-w-3xl text-center sm:mb-8">
              {block.title && (
                <h2 className="text-balance font-serif text-3xl font-semibold leading-[1.02] sm:text-5xl">
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))] sm:text-base">
                  {block.subtitle}
                </p>
              )}
            </div>
          )}

          <div
            ref={stageRef}
            data-comparison-stage
            className={cn(
              "group relative isolate w-full cursor-ew-resize touch-pan-y select-none overflow-hidden border border-[hsl(var(--border))] bg-[hsl(var(--muted))] shadow-[0_24px_80px_rgb(0_0_0/0.16)] outline-none",
              block.rounded !== false && "rounded-xl sm:rounded-2xl",
              ASPECT_CLASS[block.aspectRatio ?? "16-9"],
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div className="absolute inset-0">
              <ComparisonImage
                photo={leftPhoto}
                label={leftLabel}
                missingLabel="Choose left image"
                priority
              />
            </div>
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${position}%)` }}
            >
              <ComparisonImage
                photo={rightPhoto}
                label={rightLabel}
                missingLabel="Choose right image"
                priority
              />
            </div>

            <div
              data-comparison-label
              className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm backdrop-blur"
            >
              {leftLabel}
            </div>
            <div
              data-comparison-label
              className="pointer-events-none absolute right-4 top-4 z-20 rounded-full bg-white/88 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-950 shadow-sm backdrop-blur"
            >
              {rightLabel}
            </div>

            <div
              className="absolute inset-y-0 z-30 w-px bg-[var(--image-comparison-handle)] shadow-[0_0_20px_rgb(0_0_0/0.34)]"
              style={{ left: `${position}%` }}
              aria-hidden="true"
            />
            <div
              data-comparison-handle
              role="slider"
              aria-label="Image comparison position"
              aria-valuemin={5}
              aria-valuemax={95}
              aria-valuenow={Math.round(position)}
              aria-valuetext={`${Math.round(position)} percent`}
              tabIndex={0}
              className="absolute top-1/2 z-40 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border border-white/70 bg-[var(--image-comparison-handle)] text-neutral-950 shadow-[0_12px_30px_rgb(0_0_0/0.28)] outline-none ring-offset-2 transition-transform group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
              style={{ left: `${position}%` }}
              onKeyDown={onKeyDown}
            >
              <ChevronsLeftRight className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
