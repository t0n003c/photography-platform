"use client";

import * as React from "react";
import { Camera } from "lucide-react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";
import { FlipReveal, FlipRevealItem } from "@/components/ui/flip-reveal";
import { ResponsiveImage } from "./responsive-image";
import { Lightbox } from "./lightbox";

export interface FlipRevealFilterTab {
  key: string;
  label: string;
  photoIds?: string[];
}

export type FlipRevealSortMode =
  | "source"
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "custom";

export interface FlipRevealSortConfig {
  mode: FlipRevealSortMode;
  photoIds?: string[];
  overrides?: Record<string, { mode: FlipRevealSortMode; photoIds?: string[] }>;
}

export type FilteredGalleryStyle = "flip-reveal" | "tora-portfolio-masonry";

interface FlipRevealGalleryProps {
  photos: PhotoDTO[];
  tabs: FlipRevealFilterTab[];
  photoFilters: Record<string, string[]>;
  filterStyle?: FilteredGalleryStyle;
  showOverlayText?: boolean;
  toraPortfolioFilterTextSize?: number;
  toraPortfolioSeparatorSize?: number;
  sort?: FlipRevealSortConfig;
}

function photoTitle(photo: PhotoDTO): string {
  return (
    photo.headline?.trim() ||
    photo.altText?.trim() ||
    photo.caption?.trim() ||
    "Untitled"
  );
}

function photoSubtitle(photo: PhotoDTO): string {
  if (photo.caption?.trim() && photo.caption.trim() !== photoTitle(photo)) {
    return photo.caption.trim();
  }
  return photo.subhead?.trim() || "Portfolio image";
}

function photoDate(photo: PhotoDTO): number | null {
  if (!photo.capturedAt) return null;
  const value = Date.parse(photo.capturedAt);
  return Number.isFinite(value) ? value : null;
}

function sortPhotos(
  photos: PhotoDTO[],
  sourceIndex: Map<string, number>,
  mode: FlipRevealSortMode,
  customIds: string[] = [],
): PhotoDTO[] {
  const customIndex = new Map(customIds.map((id, index) => [id, index]));
  const sourceRank = (photo: PhotoDTO) => sourceIndex.get(photo.id) ?? 0;
  const customRank = (photo: PhotoDTO) =>
    customIndex.has(photo.id) ? customIndex.get(photo.id)! : Number.POSITIVE_INFINITY;
  return [...photos].sort((a, b) => {
    if (mode === "custom") {
      const custom = customRank(a) - customRank(b);
      if (custom !== 0) return custom;
      return sourceRank(a) - sourceRank(b);
    }
    if (mode === "newest" || mode === "oldest") {
      const da = photoDate(a);
      const db = photoDate(b);
      if (da != null && db != null && da !== db) {
        return mode === "newest" ? db - da : da - db;
      }
      if (da != null && db == null) return -1;
      if (da == null && db != null) return 1;
      return sourceRank(a) - sourceRank(b);
    }
    if (mode === "title-asc" || mode === "title-desc") {
      const value = photoTitle(a).localeCompare(photoTitle(b), undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (value !== 0) return mode === "title-asc" ? value : -value;
      return sourceRank(a) - sourceRank(b);
    }
    return sourceRank(a) - sourceRank(b);
  });
}

type PortfolioMasonryItem = {
  photo: PhotoDTO;
  index: number;
};

function portfolioColumnCount(width: number) {
  if (width <= 520) return 1;
  if (width <= 1024) return 3;
  return 4;
}

function clampNumber(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function distributePortfolioColumns(
  items: PortfolioMasonryItem[],
  columnCount: number,
) {
  const columns = Array.from({ length: columnCount }, () => ({
    height: 0,
    items: [] as PortfolioMasonryItem[],
  }));

  items.forEach((item) => {
    const ratio =
      item.photo.width > 0 && item.photo.height > 0
        ? item.photo.height / item.photo.width
        : 1;
    const target = columns.reduce((shortest, column) =>
      column.height < shortest.height ? column : shortest,
    );
    target.items.push(item);
    target.height += Math.max(0.45, ratio);
  });

  return columns;
}

function ToraPortfolioMasonryGallery({
  photos,
  tabs,
  photoFilters,
  showOverlayText = true,
  toraPortfolioFilterTextSize,
  toraPortfolioSeparatorSize,
  sort,
}: Omit<FlipRevealGalleryProps, "filterStyle">) {
  const initialKey = tabs[0]?.key ?? "all";
  const rootRef = React.useRef<HTMLElement>(null);
  const itemRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const previousRectsRef = React.useRef(new Map<string, DOMRect>());
  const pendingFlipRef = React.useRef(false);
  const didMeasureRef = React.useRef(false);
  const [activeKey, setActiveKey] = React.useState(initialKey);
  const [columnCount, setColumnCount] = React.useState(4);
  const [mounted, setMounted] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const sourceIndex = React.useMemo(
    () => new Map(photos.map((photo, index) => [photo.id, index])),
    [photos],
  );
  const filterTabs = React.useMemo(
    () => [{ key: "all", label: "All" }, ...tabs],
    [tabs],
  );
  const activePhotos = React.useMemo(() => {
    if (activeKey === "all") return photos;
    return photos.filter((photo) => photoFilters[photo.id]?.includes(activeKey));
  }, [activeKey, photoFilters, photos]);
  const orderedPhotos = React.useMemo(() => {
    const tab = tabs.find((item) => item.key === activeKey);
    const override = sort?.overrides?.[activeKey];
    const mode = override?.mode ?? sort?.mode ?? "source";
    const customIds =
      override?.photoIds && override.photoIds.length > 0
        ? override.photoIds
        : activeKey !== "all" && tab?.photoIds?.length
        ? tab.photoIds
        : sort?.photoIds ?? [];
    return sortPhotos(activePhotos, sourceIndex, mode, customIds);
  }, [activeKey, activePhotos, sort, sourceIndex, tabs]);
  const visibleItems = React.useMemo(
    () =>
      orderedPhotos.map((photo) => ({
        photo,
        index: sourceIndex.get(photo.id) ?? 0,
      })),
    [orderedPhotos, sourceIndex],
  );
  const columns = React.useMemo(
    () => distributePortfolioColumns(visibleItems, columnCount),
    [columnCount, visibleItems],
  );
  const filterTextSize = clampNumber(toraPortfolioFilterTextSize, 18, 48, 30);
  const separatorSize = clampNumber(toraPortfolioSeparatorSize, 16, 90, 55);
  const style = {
    "--tora-portfolio-filter-size": `${filterTextSize}px`,
    "--tora-portfolio-separator-size": `${separatorSize}px`,
  } as React.CSSProperties;

  const reduceMotion = React.useCallback(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const captureItemRects = React.useCallback(() => {
    const rects = new Map<string, DOMRect>();
    itemRefs.current.forEach((element, id) => {
      rects.set(id, element.getBoundingClientRect());
    });
    return rects;
  }, []);

  React.useEffect(() => {
    if (activeKey === "all" || tabs.some((tab) => tab.key === activeKey)) return;
    setActiveKey(tabs[0]?.key ?? "all");
  }, [activeKey, tabs]);

  React.useEffect(() => {
    setMounted(true);
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      const nextColumnCount = portfolioColumnCount(
        root.clientWidth || window.innerWidth,
      );
      setColumnCount((currentColumnCount) => {
        if (currentColumnCount === nextColumnCount) return currentColumnCount;
        if (didMeasureRef.current && !reduceMotion()) {
          previousRectsRef.current = captureItemRects();
          pendingFlipRef.current = true;
        }
        return nextColumnCount;
      });
      didMeasureRef.current = true;
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [captureItemRects, reduceMotion]);

  React.useLayoutEffect(() => {
    if (!pendingFlipRef.current) return;
    pendingFlipRef.current = false;
    const previousRects = previousRectsRef.current;
    previousRectsRef.current = new Map();
    if (reduceMotion()) return;

    itemRefs.current.forEach((element, id) => {
      element.getAnimations().forEach((animation) => animation.cancel());
      const before = previousRects.get(id);
      if (!before) {
        element.animate(
          [
            { opacity: 0, transform: "translate3d(0, 18px, 0) scale(0.98)" },
            { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
          ],
          {
            duration: 760,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        );
        return;
      }
      const after = element.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      const scaleX = before.width / Math.max(after.width, 1);
      const scaleY = before.height / Math.max(after.height, 1);
      const moved =
        Math.abs(dx) > 0.5 ||
        Math.abs(dy) > 0.5 ||
        Math.abs(scaleX - 1) > 0.01 ||
        Math.abs(scaleY - 1) > 0.01;
      if (!moved) return;

      element.animate(
        [
          {
            transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`,
            transformOrigin: "top left",
          },
          {
            transform: "translate3d(0, 0, 0) scale(1, 1)",
            transformOrigin: "top left",
          },
        ],
        {
          duration: 1000,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
  }, [columns, reduceMotion]);

  const selectFilter = (key: string) => {
    if (key === activeKey) return;
    if (!reduceMotion()) {
      previousRectsRef.current = captureItemRects();
      pendingFlipRef.current = true;
    }
    setActiveKey(key);
  };

  const openAt = React.useCallback((index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  }, []);

  const item = ({ photo, index }: PortfolioMasonryItem) => {
    const label = photoTitle(photo);
    return (
      <button
        key={photo.id}
        ref={(element) => {
          if (element) itemRefs.current.set(photo.id, element);
          else itemRefs.current.delete(photo.id);
        }}
        type="button"
        aria-label={`View ${label}`}
        className={cn(
          "tora-portfolio-masonry__item",
          !showOverlayText && "tora-portfolio-masonry__item--no-overlay",
        )}
        onClick={() => openAt(index)}
      >
        <ResponsiveImage
          photo={photo}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 100vw"
          priority={index < 4}
          className="tora-portfolio-masonry__picture"
          imgClassName="tora-portfolio-masonry__image"
        />
        {showOverlayText && (
          <span className="tora-portfolio-masonry__cover" aria-hidden="true">
            <span className="tora-portfolio-masonry__camera">
              <Camera className="h-5 w-5" strokeWidth={1.8} />
            </span>
          </span>
        )}
      </button>
    );
  };

  return (
    <section ref={rootRef} className="tora-portfolio-masonry" style={style}>
      <div
        role="tablist"
        aria-label="Gallery filters"
        className="tora-portfolio-masonry__filters"
      >
        {filterTabs.map((tab) => {
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectFilter(tab.key)}
              className={cn(
                "tora-portfolio-masonry__filter",
                active && "is-active",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {visibleItems.length > 0 ? (
        mounted ? (
          <div className="tora-portfolio-masonry__columns">
            {columns.map((column, columnIndex) => (
              <div className="tora-portfolio-masonry__column" key={columnIndex}>
                {column.items.map(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="tora-portfolio-masonry__fallback">
            {visibleItems.map(item)}
          </div>
        )
      ) : (
        <p className="tora-portfolio-masonry__empty">
          No photos in this filter.
        </p>
      )}

      <Lightbox
        photos={photos}
        index={activeIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setActiveIndex}
      />
    </section>
  );
}

function DefaultFlipRevealGallery({
  photos,
  tabs,
  photoFilters,
  showOverlayText = true,
  sort,
}: Omit<FlipRevealGalleryProps, "filterStyle">) {
  const [activeKey, setActiveKey] = React.useState("all");
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const sourceIndex = React.useMemo(
    () => new Map(photos.map((photo, index) => [photo.id, index])),
    [photos],
  );
  const activePhotos = React.useMemo(() => {
    if (activeKey === "all") return photos;
    return photos.filter((photo) => photoFilters[photo.id]?.includes(activeKey));
  }, [activeKey, photoFilters, photos]);
  const itemOrder = React.useMemo(() => {
    const tab = tabs.find((item) => item.key === activeKey);
    const override = sort?.overrides?.[activeKey];
    const mode = override?.mode ?? sort?.mode ?? "source";
    const customIds =
      override?.photoIds && override.photoIds.length > 0
        ? override.photoIds
        : activeKey !== "all" && tab?.photoIds?.length
        ? tab.photoIds
        : sort?.photoIds ?? [];
    const ordered = sortPhotos(activePhotos, sourceIndex, mode, customIds);
    const order: Record<string, number> = {};
    ordered.forEach((photo, index) => {
      order[photo.id] = index;
    });
    photos.forEach((photo) => {
      if (order[photo.id] == null) {
        order[photo.id] = ordered.length + (sourceIndex.get(photo.id) ?? 0);
      }
    });
    return order;
  }, [activeKey, activePhotos, photos, sort, sourceIndex, tabs]);

  const openAt = React.useCallback((photoId: string) => {
    const index = photos.findIndex((photo) => photo.id === photoId);
    setActiveIndex(Math.max(0, index));
    setLightboxOpen(true);
  }, [photos]);

  return (
    <div className="flip-reveal-gallery">
      <div
        role="tablist"
        aria-label="Gallery filters"
        className="mb-7 flex flex-wrap items-center justify-center gap-2 sm:mb-8"
      >
        {[{ key: "all", label: "All" }, ...tabs].map((tab) => {
          const active = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveKey(tab.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <FlipReveal
        keys={[activeKey]}
        itemOrder={itemOrder}
        showClass="block"
        hideClass="hidden"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
      >
        {photos.map((photo, index) => {
          const keys = photoFilters[photo.id] ?? [];
          return (
            <FlipRevealItem
              key={photo.id}
              flipId={photo.id}
              flipKey={keys.join("|")}
              className="group block"
            >
              <button
                type="button"
                onClick={() => openAt(photo.id)}
                className="relative block aspect-[4/5] w-full overflow-hidden rounded-md bg-[hsl(var(--muted))] text-left shadow-sm transition-transform duration-300 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ResponsiveImage
                  photo={photo}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={index < 4}
                  className="h-full w-full"
                />
                {showOverlayText && (
                  <>
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-85 transition-opacity duration-300 group-hover:opacity-95" />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 block p-3 text-white sm:p-4">
                      <span className="block text-sm font-semibold leading-tight sm:text-base">
                        {photoTitle(photo)}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-snug text-white/75">
                        {photoSubtitle(photo)}
                      </span>
                    </span>
                  </>
                )}
              </button>
            </FlipRevealItem>
          );
        })}
      </FlipReveal>

      {activePhotos.length === 0 && (
        <p className="mt-6 text-center text-sm text-[hsl(var(--muted-foreground))]">
          No photos in this filter.
        </p>
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

export function FlipRevealGallery({
  filterStyle = "flip-reveal",
  ...props
}: FlipRevealGalleryProps) {
  if (filterStyle === "tora-portfolio-masonry") {
    return <ToraPortfolioMasonryGallery {...props} />;
  }
  return <DefaultFlipRevealGallery {...props} />;
}
