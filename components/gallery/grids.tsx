import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";
import { ResponsiveImage } from "./responsive-image";

export interface GridProps {
  photos: PhotoDTO[];
  /** Tailwind gap class(es), e.g. "gap-2 md:gap-3". */
  spacingClass: string;
  onOpen: (index: number) => void;
}

function ratio(photo: PhotoDTO): number {
  if (!photo.height) return 1;
  return photo.width / photo.height;
}

function tileLabel(photo: PhotoDTO): string {
  return `View ${photo.altText || "photo"}`;
}

/** Masonry via CSS columns; items avoid breaking across columns. */
export function MasonryGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div className={cn("columns-2 md:columns-3 xl:columns-4", spacingClass)}>
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={tileLabel(photo)}
          className="mb-2 block w-full break-inside-avoid overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background md:mb-3"
        >
          <ResponsiveImage
            photo={photo}
            sizes="(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw"
            className="transition-opacity hover:opacity-90"
          />
        </button>
      ))}
    </div>
  );
}

/** Uniform grid of square-cropped tiles. */
export function UniformGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        spacingClass,
      )}
    >
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={tileLabel(photo)}
          className="block aspect-square w-full overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ResponsiveImage
            photo={photo}
            sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
            className="h-full w-full transition-opacity hover:opacity-90"
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Justified rows: flexbox where each item grows proportionally to its aspect
 * ratio so rows fill the available width at a roughly uniform height.
 */
export function JustifiedGrid({ photos, spacingClass, onOpen }: GridProps) {
  return (
    <div className={cn("flex flex-wrap", spacingClass)}>
      {photos.map((photo, i) => {
        const ar = ratio(photo);
        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={tileLabel(photo)}
            style={{ flexGrow: ar, flexBasis: ar * 260 }}
            className="block h-[260px] overflow-hidden rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ResponsiveImage
              photo={photo}
              sizes="(min-width:768px) 33vw, 50vw"
              className="h-full w-full transition-opacity hover:opacity-90"
            />
          </button>
        );
      })}
    </div>
  );
}
