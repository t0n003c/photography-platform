"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { CssGlitchImage, type CssGlitchVariant } from "./css-glitch";

const GLITCH_STYLES: CssGlitchVariant[] = [
  "style-1",
  "style-2",
  "style-3",
  "style-4",
  "style-5",
  "style-6",
];

function titleFor(photo: PhotoDTO, fallback: string) {
  return photo.altText || photo.caption || fallback;
}

function splitTitle(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [value, ""] as const;
  return [words.slice(0, -1).join(" "), words[words.length - 1]] as const;
}

export function GlitchHoverGrid({
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
  const displayPhotos = photos.slice(0, 24);

  return (
    <section className="css-glitch-gallery min-h-screen bg-[#101112] px-5 py-16 text-white sm:px-8 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/45">
              CSS Glitch
            </p>
            <h1 className="mt-2 max-w-4xl font-serif text-[clamp(2.6rem,9vw,8.5rem)] font-black leading-[0.82] tracking-normal">
              {title || "Glitch"}
            </h1>
          </div>
          {subtitle && (
            <p className="max-w-sm text-sm leading-relaxed text-white/62 md:text-right">
              {subtitle}
            </p>
          )}
        </header>
        <div className="css-glitch-grid">
          {displayPhotos.map((photo, index) => {
            const [main, accent] = splitTitle(titleFor(photo, `Image ${index + 1}`));
            return (
              <button
                key={photo.id}
                type="button"
                className="css-glitch-card group"
                onClick={() => onOpen(index)}
                aria-label={`View ${titleFor(photo, `image ${index + 1}`)}`}
              >
                <CssGlitchImage
                  photo={photo}
                  variant={GLITCH_STYLES[index % GLITCH_STYLES.length]}
                  className="h-full w-full"
                />
                <span className="css-glitch-card__title">
                  {main} {accent && <span>{accent}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
