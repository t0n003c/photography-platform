"use client";

import { cn } from "@/src/lib/utils";

export interface PhotoOption {
  id: string;
  label: string;
  thumbUrl: string | null;
}

/**
 * Visual photo picker for the page builder. Native <option> elements can't show
 * images, so block editors use this thumbnail grid instead — you see exactly
 * which photo you're choosing. Click a selected tile again to clear it.
 */
export function PhotoPicker({
  photos,
  value,
  onChange,
}: {
  photos: PhotoOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  if (photos.length === 0) {
    return (
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        No photos in your library yet — upload some first.
      </p>
    );
  }
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border p-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {photos.map((p) => {
          const selected = p.id === value;
          return (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : p.id)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border bg-[hsl(var(--muted))] transition",
                selected
                  ? "ring-2 ring-[hsl(var(--ring))] ring-offset-1"
                  : "hover:opacity-90",
              )}
            >
              {p.thumbUrl ? (
                <img
                  src={p.thumbUrl}
                  alt={p.label}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] leading-tight text-[hsl(var(--muted-foreground))]">
                  {p.label}
                </span>
              )}
              {selected && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[10px] text-[hsl(var(--primary-foreground))]">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
