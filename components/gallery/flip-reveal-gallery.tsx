"use client";

import * as React from "react";
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

interface FlipRevealGalleryProps {
  photos: PhotoDTO[];
  tabs: FlipRevealFilterTab[];
  photoFilters: Record<string, string[]>;
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

export function FlipRevealGallery({
  photos,
  tabs,
  photoFilters,
  sort,
}: FlipRevealGalleryProps) {
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
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-85 transition-opacity duration-300 group-hover:opacity-95" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 block p-3 text-white sm:p-4">
                  <span className="block text-sm font-semibold leading-tight sm:text-base">
                    {photoTitle(photo)}
                  </span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-snug text-white/75">
                    {photoSubtitle(photo)}
                  </span>
                </span>
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
