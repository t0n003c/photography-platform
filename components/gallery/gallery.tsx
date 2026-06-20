"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import {
  CarouselGrid,
  FilmstripGrid,
  JustifiedGrid,
  MasonryGrid,
  MosaicGrid,
  UniformGrid,
} from "./grids";
import { Carousel3D } from "./carousel-3d";
import { Lightbox } from "./lightbox";

interface GalleryLayout {
  gridType:
    | "masonry"
    | "justified"
    | "uniform"
    | "carousel"
    | "filmstrip"
    | "mosaic"
    | "carousel3d"
    | "cinematic";
  spacing?: "tight" | "normal" | "airy" | string | null;
  /** Carousel only: auto-advance through slides. */
  autoplay?: boolean;
}

interface GalleryProps {
  photos: PhotoDTO[];
  layout: GalleryLayout;
  initialCursor?: string | null;
  loadMoreUrl?: string | null;
}

interface PageResponse {
  data: PhotoDTO[];
  page: { nextCursor: string | null; hasMore: boolean };
}

const SPACING_CLASSES: Record<string, string> = {
  tight: "gap-1",
  normal: "gap-2 md:gap-3",
  airy: "gap-4 md:gap-6",
};
// Masonry uses CSS columns, where `gap` only sets the horizontal column-gap;
// the vertical gap between stacked items is an item margin-bottom. This map
// keeps that vertical margin in sync with the chosen spacing so both axes match.
const MASONRY_ITEM_SPACING: Record<string, string> = {
  tight: "mb-1",
  normal: "mb-2 md:mb-3",
  airy: "mb-4 md:mb-6",
};

function spacingToClass(spacing: GalleryLayout["spacing"]): string {
  if (spacing && SPACING_CLASSES[spacing]) return SPACING_CLASSES[spacing];
  return SPACING_CLASSES.normal;
}
function masonryItemClass(spacing: GalleryLayout["spacing"]): string {
  if (spacing && MASONRY_ITEM_SPACING[spacing]) return MASONRY_ITEM_SPACING[spacing];
  return MASONRY_ITEM_SPACING.normal;
}

export function Gallery({
  photos: initialPhotos,
  layout,
  initialCursor,
  loadMoreUrl,
}: GalleryProps) {
  const [photos, setPhotos] = React.useState<PhotoDTO[]>(initialPhotos);
  const [cursor, setCursor] = React.useState<string | null>(
    initialCursor ?? null,
  );
  const [loading, setLoading] = React.useState(false);

  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Keep local state in sync if the parent supplies a new set of photos.
  React.useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  React.useEffect(() => {
    setCursor(initialCursor ?? null);
  }, [initialCursor]);

  const openAt = React.useCallback((index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  }, []);

  const canLoadMore = Boolean(loadMoreUrl) && cursor != null;

  const loadMore = React.useCallback(async () => {
    if (!loadMoreUrl || cursor == null || loading) return;
    setLoading(true);
    try {
      const url = `${loadMoreUrl}?limit=48&cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const json = (await res.json()) as PageResponse;
      setPhotos((prev) => [...prev, ...json.data]);
      setCursor(json.page.hasMore ? json.page.nextCursor : null);
    } catch {
      // Swallow network errors; button remains for retry.
    } finally {
      setLoading(false);
    }
  }, [loadMoreUrl, cursor, loading]);

  const spacingClass = spacingToClass(layout.spacing);

  const gridProps = {
    photos,
    spacingClass,
    onOpen: openAt,
  };

  return (
    <div>
      {layout.gridType === "masonry" && (
        <MasonryGrid {...gridProps} itemSpacingClass={masonryItemClass(layout.spacing)} />
      )}
      {layout.gridType === "uniform" && <UniformGrid {...gridProps} />}
      {(layout.gridType === "justified" || layout.gridType === "cinematic") && (
        <JustifiedGrid {...gridProps} />
      )}
      {layout.gridType === "carousel" && (
        <CarouselGrid {...gridProps} autoplay={layout.autoplay} />
      )}
      {layout.gridType === "filmstrip" && <FilmstripGrid {...gridProps} />}
      {layout.gridType === "mosaic" && <MosaicGrid {...gridProps} />}
      {layout.gridType === "carousel3d" && (
        <Carousel3D photos={photos} onOpen={openAt} />
      )}

      {canLoadMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            aria-busy={loading}
            className="rounded-md border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[hsl(var(--muted))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      <Lightbox
        photos={photos}
        index={activeIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActiveIndex}
      />
    </div>
  );
}
