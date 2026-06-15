"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { ResponsiveImage } from "./responsive-image";

interface LightboxProps {
  photos: PhotoDTO[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Lightbox({
  photos,
  index,
  open,
  onClose,
  onIndexChange,
}: LightboxProps) {
  const total = photos.length;
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  const goPrev = React.useCallback(() => {
    if (total === 0) return;
    onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const goNext = React.useCallback(() => {
    if (total === 0) return;
    onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  // Lock body scroll + remember/restore focus while open.
  React.useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Keyboard handling: Escape, arrows, focus trap.
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (items.length === 0) {
          e.preventDefault();
          root.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, goPrev, goNext]);

  if (!open) return null;
  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      tabIndex={-1}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 outline-none"
    >
      {/* Top bar: counter + close */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 text-white/90">
        <span className="text-sm tabular-nums" aria-live="polite">
          {index + 1} / {total}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          className="rounded-full p-2 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          aria-label="Previous image"
          className="absolute left-2 z-10 rounded-full p-2 text-white/90 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
        >
          <ChevronLeft className="h-8 w-8" aria-hidden="true" />
        </button>
      )}

      {/* Image — clicking it must not close. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] max-w-[92vw] items-center justify-center"
      >
        <div
          className="max-h-[90vh] max-w-[92vw]"
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        >
          <ResponsiveImage
            photo={photo}
            sizes="100vw"
            priority
            className="h-full max-h-[90vh] w-full object-contain"
          />
        </div>
      </div>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          aria-label="Next image"
          className="absolute right-2 z-10 rounded-full p-2 text-white/90 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
        >
          <ChevronRight className="h-8 w-8" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
