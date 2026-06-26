"use client";

import { useRef } from "react";

/**
 * Drag (or click) to set a photo's focal point as object-position percentages.
 * The whole photo is shown; the dot marks the point the banner keeps in view
 * when object-cover crops. Works on any axis the crop has slack on.
 */
export function FocalPointPicker({
  x,
  y,
  thumbUrl,
  onChange,
}: {
  x: number;
  y: number;
  thumbUrl: string | null;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const ny = Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100));
    onChange(Math.round(nx), Math.round(ny));
  };

  return (
    <div className="space-y-1">
      <div
        ref={ref}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          update(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) update(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        className="relative aspect-[16/9] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-md border bg-[hsl(var(--muted))]"
      >
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] text-[hsl(var(--muted-foreground))]">
            Pick a photo to position it
          </span>
        )}
        <div
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-1 ring-black/50"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      </div>
      <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
        Drag the dot to set the focal point ({x}%, {y}%).
      </p>
    </div>
  );
}
