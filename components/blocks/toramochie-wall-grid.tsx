"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import type { PhotoDTO } from "@/src/db/queries/photos";
import type { LeafBlock } from "@/src/lib/blocks";
import { cn } from "@/src/lib/utils";

type BannerData = Extract<LeafBlock, { type: "banner" }>;

type GridSize = {
  rows: number;
  columns: number;
};

type Slot = {
  current: number;
  next: number;
  active: boolean;
  anim: string;
};

type TypedHeadlineParts = {
  prefix: string;
  words: string[];
};

const ANIMATIONS = [
  "fade",
  "slide-left",
  "slide-right",
  "slide-top",
  "slide-bottom",
  "rotate-left",
  "rotate-right",
  "rotate-top",
  "rotate-bottom",
  "scale",
  "rotate3d",
  "rotate-left-scale",
  "rotate-right-scale",
  "rotate-top-scale",
  "rotate-bottom-scale",
];

export const TORA_MOCHIE_DEFAULT_HEADLINE = "Hi. I am a photographer. I capture life.";
export const TORA_MOCHIE_DEFAULT_TYPED_WORDS = "life., action., people.";
const DEFAULT_TYPED_WORDS = TORA_MOCHIE_DEFAULT_TYPED_WORDS.split(",").map((word) => word.trim());

function gridForWidth(width: number): GridSize {
  if (width < 480) return { rows: 6, columns: 4 };
  if (width < 510) return { rows: 6, columns: 4 };
  if (width < 992) return { rows: 6, columns: 5 };
  if (width < 1200) return { rows: 5, columns: 7 };
  return { rows: 4, columns: 8 };
}

function makeSlots(count: number, photoCount: number): Slot[] {
  return Array.from({ length: count }, (_, index) => {
    const current = photoCount > 0 ? index % photoCount : 0;
    return {
      current,
      next: current,
      active: false,
      anim: ANIMATIONS[index % ANIMATIONS.length],
    };
  });
}

function shuffle(values: number[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function configuredWords(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
}

function splitTypedHeadline(headline: string, typewriterWords: string | undefined): TypedHeadlineParts {
  const cleanHeadline = headline.trim() || TORA_MOCHIE_DEFAULT_HEADLINE;
  let words = configuredWords(typewriterWords);
  if (words.length === 0) {
    const lastWord = cleanHeadline.match(/(\S+)$/)?.[1] ?? cleanHeadline;
    const normalizedLastWord = lastWord.toLowerCase().replace(/[^\p{L}\p{N}]+$/u, "");
    words =
      cleanHeadline.toLowerCase().includes("capture life") || normalizedLastWord === "life"
        ? DEFAULT_TYPED_WORDS
        : [
            lastWord,
            ...DEFAULT_TYPED_WORDS.filter(
              (word) => word.toLowerCase() !== lastWord.toLowerCase(),
            ),
          ].slice(0, 3);
  }

  const firstWord = words[0] ?? "";
  if (firstWord && cleanHeadline.endsWith(firstWord)) {
    return {
      prefix: cleanHeadline.slice(0, cleanHeadline.length - firstWord.length),
      words,
    };
  }

  const lastWordMatch = cleanHeadline.match(/^(.*\s)(\S+)$/);
  if (lastWordMatch && words.length > 1) {
    return { prefix: lastWordMatch[1], words };
  }

  return {
    prefix: cleanHeadline ? `${cleanHeadline} ` : "",
    words,
  };
}

export function ToraMochieTypedHeadline({
  headline,
  typewriterWords,
}: {
  headline: string;
  typewriterWords?: string;
}) {
  const reducedMotion = useReducedMotion();
  const { prefix, words } = useMemo(
    () => splitTypedHeadline(headline, typewriterWords),
    [headline, typewriterWords],
  );
  const initialWord = words[0] ?? "";
  const [typedWord, setTypedWord] = useState(initialWord);
  const label = `${prefix}${initialWord}`.trim();

  useEffect(() => {
    setTypedWord(initialWord);
  }, [initialWord]);

  useEffect(() => {
    if (reducedMotion || words.length < 2) return;

    let cancelled = false;
    let timeout: number | undefined;
    let index = 0;
    let current = words[index] ?? "";

    const schedule = (fn: () => void, ms: number) => {
      timeout = window.setTimeout(fn, ms);
    };

    const typeWord = (position: number) => {
      if (cancelled) return;
      const word = words[index] ?? "";
      current = word.slice(0, position);
      setTypedWord(current);
      if (position < word.length) {
        schedule(() => typeWord(position + 1), 30);
      } else {
        schedule(deleteWord, 500);
      }
    };

    const deleteWord = () => {
      if (cancelled) return;
      if (current.length > 0) {
        current = current.slice(0, -1);
        setTypedWord(current);
        schedule(deleteWord, 20);
      } else {
        index = (index + 1) % words.length;
        schedule(() => typeWord(1), 30);
      }
    };

    schedule(deleteWord, 1200);

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [initialWord, reducedMotion, words]);

  return (
    <mark className="tora-wall-mark" aria-label={label}>
      <span aria-hidden="true">
        {prefix && <span className="tora-wall-prefix">{prefix}</span>}
        <span className={cn("tora-wall-typed", !prefix && "tora-wall-typed-only")}>
          {typedWord}
        </span>
      </span>
    </mark>
  );
}

// Reference source: Reflector's gridrotator uses 4x8 desktop cells, responsive
// rows/columns, and swaps 7 random cells every 3s with mixed 3D/slide/fade
// transitions. Deviation: we keep the same beat in React/CSS instead of loading
// the old jQuery plugin, so SSR and reduced-motion remain usable.
export function ToraMochieWallGrid({
  block,
  photos,
}: {
  block: BannerData;
  photos: PhotoDTO[];
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number[]>([]);
  const roundRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [grid, setGrid] = useState<GridSize>({ rows: 4, columns: 8 });
  const cellCount = grid.rows * grid.columns;
  const [slots, setSlots] = useState<Slot[]>(() => makeSlots(32, photos.length));
  const visiblePhotos = useMemo(() => photos.filter(Boolean), [photos]);
  const fx = block.focalX ?? 50;
  const fy = block.focalY ?? 50;

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const sync = () => {
      const width = el.getBoundingClientRect().width || window.innerWidth;
      setGrid(gridForWidth(width));
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSlots((previous) => {
      const resized = makeSlots(cellCount, visiblePhotos.length);
      return resized.map((slot, index) => {
        const old = previous[index];
        if (!old || visiblePhotos.length === 0) return slot;
        const current = old.current % visiblePhotos.length;
        return {
          ...slot,
          current,
          next: old.next % visiblePhotos.length,
          active: false,
          anim: old.anim,
        };
      });
    });
  }, [cellCount, visiblePhotos.length]);

  useEffect(() => {
    if (reducedMotion || visiblePhotos.length < 2) return;
    const rotate = () => {
      roundRef.current += 1;
      setSlots((previous) => {
        const candidates = previous
          .map((slot, index) => ({ slot, index }))
          .filter(({ slot }) => !slot.active)
          .map(({ index }) => index);
        const selected = new Set(shuffle(candidates).slice(0, Math.min(7, candidates.length)));
        return previous.map((slot, index) => {
          if (!selected.has(index)) return slot;
          const nextPhoto = (slot.current + roundRef.current + index + 1) % visiblePhotos.length;
          return {
            current: slot.current,
            next: nextPhoto,
            active: true,
            anim: ANIMATIONS[(index + roundRef.current) % ANIMATIONS.length],
          };
        });
      });
      const timeout = window.setTimeout(() => {
        setSlots((previous) =>
          previous.map((slot) =>
            slot.active
              ? {
                  current: slot.next,
                  next: slot.next,
                  active: false,
                  anim: slot.anim,
                }
              : slot,
          ),
        );
      }, 860);
      timeoutRef.current.push(timeout);
    };
    const interval = window.setInterval(rotate, 3000);
    const first = window.setTimeout(rotate, 1200);
    timeoutRef.current.push(first);
    return () => {
      window.clearInterval(interval);
      for (const timeout of timeoutRef.current) window.clearTimeout(timeout);
      timeoutRef.current = [];
    };
  }, [reducedMotion, visiblePhotos.length]);

  if (visiblePhotos.length === 0) return null;

  return (
    <div
      ref={gridRef}
      aria-hidden="true"
      className="tora-wall-grid"
      style={
        {
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
        } as CSSProperties
      }
    >
      {slots.map((slot, index) => {
        const front = visiblePhotos[slot.current % visiblePhotos.length];
        const back = visiblePhotos[slot.next % visiblePhotos.length];
        return (
          <div
            key={index}
            className={cn("tora-wall-cell", slot.active && "is-swapping")}
            data-anim={slot.anim}
          >
            <div className="tora-wall-face tora-wall-front">
              <ResponsiveImage
                photo={front}
                sizes="(min-width: 1200px) 13vw, (min-width: 992px) 15vw, (min-width: 510px) 20vw, 25vw"
                className="h-full w-full"
                objectPosition={`${fx}% ${fy}%`}
              />
            </div>
            <div className="tora-wall-face tora-wall-back">
              <ResponsiveImage
                photo={back}
                sizes="(min-width: 1200px) 13vw, (min-width: 992px) 15vw, (min-width: 510px) 20vw, 25vw"
                className="h-full w-full"
                objectPosition={`${fx}% ${fy}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
