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
}

interface FlipRevealGalleryProps {
  photos: PhotoDTO[];
  tabs: FlipRevealFilterTab[];
  photoFilters: Record<string, string[]>;
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

export function FlipRevealGallery({
  photos,
  tabs,
  photoFilters,
}: FlipRevealGalleryProps) {
  const [activeKey, setActiveKey] = React.useState("all");
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const activePhotos = React.useMemo(() => {
    if (activeKey === "all") return photos;
    return photos.filter((photo) => photoFilters[photo.id]?.includes(activeKey));
  }, [activeKey, photoFilters, photos]);

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
        showClass="block"
        hideClass="hidden"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
      >
        {photos.map((photo, index) => {
          const keys = photoFilters[photo.id] ?? [];
          return (
            <FlipRevealItem
              key={photo.id}
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
