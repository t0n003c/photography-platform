"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import {
  CarouselGrid,
  FilmstripGrid,
  HorizontalLenisGrid,
  JustifiedGrid,
  MasonryGrid,
  MosaicGrid,
  UniformGrid,
} from "./grids";
import { Carousel3D } from "./carousel-3d";
import { ParallaxRing } from "./parallax-ring";
import { ImageTrail } from "./image-trail";
import { RotatingScroll } from "./rotating-scroll";
import { Carousel3DScroll } from "@/components/blocks/carousel-3d-scroll";
import { ColumnScroll } from "@/components/blocks/column-scroll";
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
    | "cinematic"
    | "horizontal-lenis"
    | "parallax-ring"
    | "image-trail"
    | "rotating-scroll"
    | "carousel-3d-scroll"
    | "alternative-scroll";
  spacing?: "tight" | "normal" | "airy" | string | null;
  /** Carousel only: auto-advance through slides. */
  autoplay?: boolean;
  /** 3D infinite carousel only: colored vs. neutral gradient backdrop. */
  backdrop?: "color" | "neutral";
  /** Horizontal-scroll only: text-overlay style for the detail view. */
  overlay?: "minimal" | "editorial" | "centered";
  /** Alternative-scroll only: colors and text visibility. */
  alternativeScroll?: {
    useBackground: boolean;
    backgroundColor: string;
    textColor: string;
    showText: boolean;
  };
  /** Image-trail only: Codrops demo variant and background. */
  imageTrail?: {
    variant?:
      | "fade-shrink"
      | "zoom-fade"
      | "drop"
      | "scatter"
      | "stretch-drop"
      | "full-frame";
    useBackground?: boolean;
    backgroundColor?: string;
  };
  /** Rotating-on-scroll only: Codrops demo variant, background, and marquee. */
  rotatingScroll?: {
    variant?: "demo1" | "demo2" | "demo3" | "demo4" | "demo5";
    useBackground?: boolean;
    backgroundColor?: string;
    marqueeText?: string;
  };
}

interface GalleryProps {
  photos: PhotoDTO[];
  layout: GalleryLayout;
  initialCursor?: string | null;
  loadMoreUrl?: string | null;
  /** The collection this gallery belongs to — needed by layouts that title the
   *  whole set (e.g. the 3D scroll carousel). */
  collection?: {
    name: string;
    subtitle?: string | null;
    slug: string;
    kind: "category" | "location" | "gallery";
  };
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
  collection,
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

  // The 3D scroll carousel is a standalone full-bleed experience (it has its own
  // click-to-open preview grid), so it renders on its own — no load-more/lightbox.
  if (
    layout.gridType === "carousel-3d-scroll" &&
    collection &&
    collection.kind !== "gallery"
  ) {
    return (
      <Carousel3DScroll
        scenes={[
          { slug: collection.slug, name: collection.name, kind: collection.kind, photos },
        ]}
      />
    );
  }

  // Alternative Scroll (Codrops ColumnScroll port): a standalone full-bleed
  // experience with its own click→content view. Works on any surface (needs only
  // photos); the collection name, when present, becomes the split heading.
  if (layout.gridType === "alternative-scroll") {
    return (
      <ColumnScroll
        photos={photos}
        title={collection?.name}
        subtitle={collection?.subtitle}
        useBackground={layout.alternativeScroll?.useBackground}
        backgroundColor={layout.alternativeScroll?.backgroundColor}
        textColor={layout.alternativeScroll?.textColor}
        showText={layout.alternativeScroll?.showText}
      />
    );
  }

  if (layout.gridType === "parallax-ring") {
    return (
      <div>
        <ParallaxRing
          photos={photos}
          title={collection?.name}
          subtitle={collection?.subtitle}
          onOpen={openAt}
        />
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

  if (layout.gridType === "image-trail") {
    return (
      <div>
        <ImageTrail
          photos={photos}
          title={collection?.name}
          subtitle={collection?.subtitle}
          variant={layout.imageTrail?.variant}
          useBackground={layout.imageTrail?.useBackground}
          backgroundColor={layout.imageTrail?.backgroundColor}
          onOpen={openAt}
        />
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

  if (layout.gridType === "rotating-scroll") {
    return (
      <div>
        <RotatingScroll
          photos={photos}
          title={collection?.name}
          subtitle={collection?.subtitle}
          variant={layout.rotatingScroll?.variant}
          useBackground={layout.rotatingScroll?.useBackground}
          backgroundColor={layout.rotatingScroll?.backgroundColor}
          marqueeText={layout.rotatingScroll?.marqueeText}
          onOpen={openAt}
        />
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

  const grid = (
    <>
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
        <Carousel3D photos={photos} onOpen={openAt} backdrop={layout.backdrop} />
      )}
      {layout.gridType === "horizontal-lenis" && (
        <HorizontalLenisGrid {...gridProps} overlay={layout.overlay} />
      )}
    </>
  );

  return (
    <div>
      {grid}

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
