"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { ResponsiveImage } from "./responsive-image";

// 3D infinite carousel. Adapted from the technique in
// github.com/clementgrellier/gradientslider: a horizontally looping ring of
// cards transformed in CSS 3D (rotateY/translateZ/scale by distance from
// center), driven by wheel + drag with momentum, over a Canvas-2D gradient
// backdrop that reacts to the active photo's dominant color.
//
// It degrades to an accessible horizontal scroll row before hydration and
// under prefers-reduced-motion (the cards are always real <button>s).

// ── Physics / look constants ─────────────────────────────────────────────────
const FRICTION = 0.92; // per-frame velocity decay
const WHEEL_SENS = 0.18;
const DRAG_SENS = 1.0;
const MAX_ROTATION = 30; // deg at the edges
const MAX_DEPTH = 160; // px translateZ at center
const MIN_SCALE = 0.84;
const MAX_SCALE = 1.05;
const SCALE_RANGE = MAX_SCALE - MIN_SCALE;
const GAP = 36; // px between cards
const CLICK_SLOP = 6; // px of movement before a pointer-down counts as a drag

const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type RGB = [number, number, number];

function hexToRgb(hex: string | null): RGB | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  const seg = Math.floor(h * 6) % 6;
  if (seg === 0) [r, g, b] = [c, x, 0];
  else if (seg === 1) [r, g, b] = [x, c, 0];
  else if (seg === 2) [r, g, b] = [0, c, x];
  else if (seg === 3) [r, g, b] = [0, x, c];
  else if (seg === 4) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// Read a theme HSL custom property (e.g. "--background" = "222 14% 8%") as RGB,
// so the neutral backdrop matches the active light/dark theme.
function readHslVar(name: string, fallback: RGB): RGB {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!m) return fallback;
  return hslToRgb(Number(m[1]) / 360, Number(m[2]) / 100, Number(m[3]) / 100);
}

// Two gradient colors derived from a photo's dominant color (color backdrop).
function paletteFor(photo: PhotoDTO | undefined): { c1: RGB; c2: RGB } {
  const base = hexToRgb(photo?.dominantColor ?? null) ?? [70, 84, 120];
  const [h, s, l] = rgbToHsl(base);
  const sat = clamp(s * 1.15, 0.35, 0.95);
  const c1 = hslToRgb(h, sat, clamp(l * 0.85 + 0.12, 0.28, 0.62));
  const c2 = hslToRgb((h + 0.09) % 1, sat, clamp(l * 0.85 + 0.28, 0.4, 0.72));
  return { c1, c2 };
}

function tileLabel(photo: PhotoDTO): string {
  return `View ${photo.altText || "photo"}`;
}

interface Props {
  photos: PhotoDTO[];
  onOpen: (index: number) => void;
  /** "color" tints the backdrop from each photo; "neutral" keeps it grayscale. */
  backdrop?: "color" | "neutral";
}

/** Pre-hydration / reduced-motion fallback: a plain horizontal scroll row. */
function StaticRow({ photos, onOpen }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => onOpen(i)}
          aria-label={tileLabel(photo)}
          className="block aspect-[4/5] h-72 shrink-0 overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <ResponsiveImage photo={photo} sizes="40vw" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export function Carousel3D({ photos, onOpen, backdrop = "color" }: Props) {
  const [enhanced, setEnhanced] = React.useState(false);
  const [dims, setDims] = React.useState({ w: 300, h: 384 });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const cardRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Mutable animation state (kept off React to avoid per-frame re-renders).
  const scrollX = React.useRef(0);
  const vX = React.useRef(0);
  const dimsRef = React.useRef({ w: 300, h: 384, W: 1000, H: 560 });
  const dragging = React.useRef(false);
  const moved = React.useRef(0);
  const lastX = React.useRef(0);
  const lastDx = React.useRef(0);
  const activeRef = React.useRef(-1);
  const neutralRef = React.useRef(backdrop === "neutral");
  neutralRef.current = backdrop === "neutral";
  const curPal = React.useRef({ c1: [70, 84, 120] as RGB, c2: [110, 130, 170] as RGB });
  const tgtPal = React.useRef(paletteFor(photos[0]));
  // Theme colors for the neutral backdrop (read from CSS vars; updated on theme change).
  const bgRef = React.useRef<RGB>([12, 13, 18]);
  const hintRef = React.useRef<RGB>([30, 33, 40]);

  // Re-target the (color) gradient immediately when the active photo set changes.
  React.useEffect(() => {
    const idx = activeRef.current >= 0 ? activeRef.current : 0;
    tgtPal.current = paletteFor(photos[idx]);
  }, [photos]);

  // Keep the neutral backdrop in sync with the active light/dark theme.
  React.useEffect(() => {
    if (!enhanced) return;
    const read = () => {
      bgRef.current = readHslVar("--background", [12, 13, 18]);
      hintRef.current = readHslVar("--muted", bgRef.current);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => mo.disconnect();
  }, [enhanced]);

  // Enable the interactive 3D stage only after mount, and never under
  // prefers-reduced-motion (keeps the static row for those users).
  React.useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setEnhanced(true);
  }, []);

  const measure = React.useCallback(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const W = cont.clientWidth;
    const H = cont.clientHeight;
    const h = clamp(H * 0.74, 220, 560);
    const w = Math.round(h * 0.78);
    dimsRef.current = { w, h, W, H };
    setDims({ w, h });
    const c = canvasRef.current;
    if (c) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  React.useEffect(() => {
    if (!enhanced) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [enhanced, measure]);

  // Wheel input (non-passive so we can prevent the page from scrolling).
  React.useEffect(() => {
    if (!enhanced) return;
    const cont = containerRef.current;
    if (!cont) return;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();
      vX.current += delta * WHEEL_SENS;
      vX.current = clamp(vX.current, -60, 60);
    };
    cont.addEventListener("wheel", onWheel, { passive: false });
    return () => cont.removeEventListener("wheel", onWheel);
  }, [enhanced]);

  // The render loop.
  React.useEffect(() => {
    if (!enhanced) return;
    const N = photos.length;
    let raf = 0;
    let last = 0;
    let visible = true;

    const io = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0.01 },
    );
    if (containerRef.current) io.observe(containerRef.current);

    const drawBackdrop = (t: number) => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const { W, H } = dimsRef.current;

      // Neutral: paint the theme background, then a small, tight radial hint
      // (theme "muted") that doesn't feather across the whole stage.
      if (neutralRef.current) {
        const [br, bg, bb] = bgRef.current;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = `rgb(${br | 0},${bg | 0},${bb | 0})`;
        ctx.fillRect(0, 0, W, H);
        const [hr, hg, hb] = hintRef.current;
        const rad = Math.min(W, H) * 0.5;
        const blobs = [
          { ox: 0.36, oy: 0.4, sx: 0.00018, sy: 0.00026 },
          { ox: 0.64, oy: 0.6, sx: 0.00022, sy: 0.00016 },
        ];
        for (const b of blobs) {
          const cx = W * (b.ox + 0.07 * Math.sin(t * b.sx));
          const cy = H * (b.oy + 0.07 * Math.cos(t * b.sy));
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
          g.addColorStop(0, `rgba(${hr | 0},${hg | 0},${hb | 0},0.6)`);
          g.addColorStop(0.5, `rgba(${hr | 0},${hg | 0},${hb | 0},0.12)`);
          g.addColorStop(1, `rgba(${hr | 0},${hg | 0},${hb | 0},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        return;
      }

      const cur = curPal.current;
      // ease current palette toward the active photo's target
      for (const key of ["c1", "c2"] as const) {
        const a = cur[key];
        const b = tgtPal.current[key];
        a[0] += (b[0] - a[0]) * 0.05;
        a[1] += (b[1] - a[1]) * 0.05;
        a[2] += (b[2] - a[2]) * 0.05;
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#0b0d12";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      const blobs = [
        { c: cur.c1, ox: 0.32, oy: 0.42, sx: 0.00022, sy: 0.00031 },
        { c: cur.c2, ox: 0.68, oy: 0.58, sx: 0.00028, sy: 0.00019 },
      ];
      for (const b of blobs) {
        const cx = W * (b.ox + 0.12 * Math.sin(t * b.sx));
        const cy = H * (b.oy + 0.12 * Math.cos(t * b.sy));
        const rad = Math.max(W, H) * 0.85;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const [r, gr, bl] = b.c;
        g.addColorStop(0, `rgba(${r | 0},${gr | 0},${bl | 0},0.55)`);
        g.addColorStop(1, `rgba(${r | 0},${gr | 0},${bl | 0},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const dt = Math.min(2, (now - last) / 16.67); // in 60fps-frames
      last = now;
      if (!visible) return;

      const { w, W } = dimsRef.current;
      const STEP = w + GAP;
      const TRACK = STEP * N;
      const halfW = W / 2;

      if (!dragging.current) {
        scrollX.current = mod(scrollX.current + vX.current * dt, TRACK);
        vX.current *= Math.pow(FRICTION, dt);
        if (Math.abs(vX.current) < 0.02) vX.current = 0;
      }

      let best = -1;
      let bestAbs = Infinity;
      for (let i = 0; i < N; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        let pos = i * STEP - scrollX.current;
        pos = mod(pos + TRACK / 2, TRACK) - TRACK / 2;
        const absPos = Math.abs(pos);
        if (absPos > halfW + w * 1.3) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        const norm = clamp(pos / (halfW || 1), -1, 1);
        const inv = 1 - Math.abs(norm);
        const ry = -norm * MAX_ROTATION;
        const tz = inv * MAX_DEPTH;
        const scale = MIN_SCALE + inv * SCALE_RANGE;
        el.style.transform = `translate3d(${pos.toFixed(1)}px,0,${tz.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.zIndex = String(1000 + Math.round(tz));
        el.style.opacity = (0.35 + inv * 0.65).toFixed(3);
        if (absPos < bestAbs) { bestAbs = absPos; best = i; }
      }

      if (best !== -1 && best !== activeRef.current) {
        activeRef.current = best;
        tgtPal.current = paletteFor(photos[best]);
      }
      drawBackdrop(now);
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [enhanced, photos]);

  // Pointer drag with momentum.
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = 0;
    lastX.current = e.clientX;
    lastDx.current = 0;
    vX.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    lastDx.current = dx;
    moved.current += Math.abs(dx);
    const { w } = dimsRef.current;
    const TRACK = (w + GAP) * photos.length;
    scrollX.current = mod(scrollX.current - dx * DRAG_SENS, TRACK);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    vX.current = clamp(-lastDx.current * DRAG_SENS, -60, 60);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { vX.current += 14; e.preventDefault(); }
    else if (e.key === "ArrowLeft") { vX.current -= 14; e.preventDefault(); }
  };

  if (!enhanced) return <StaticRow photos={photos} onOpen={onOpen} />;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-roledescription="3D carousel"
      aria-label="Photo carousel — drag, scroll, or use arrow keys"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className="relative h-[70vh] min-h-[420px] w-full cursor-grab touch-pan-y select-none overflow-hidden rounded-lg [perspective:1200px] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
    >
      <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
      <div ref={trackRef} className="absolute inset-0 [transform-style:preserve-3d]">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            ref={(el) => { cardRefs.current[i] = el; }}
            aria-label={tileLabel(photo)}
            onClick={() => { if (moved.current < CLICK_SLOP) onOpen(i); }}
            style={{
              width: dims.w,
              height: dims.h,
              marginLeft: -dims.w / 2,
              marginTop: -dims.h / 2,
            }}
            className="absolute left-1/2 top-1/2 overflow-hidden rounded-md shadow-2xl ring-1 ring-black/30 will-change-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
          >
            <ResponsiveImage
              photo={photo}
              sizes="40vw"
              className="pointer-events-none h-full w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
