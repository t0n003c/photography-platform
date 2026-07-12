/*
 * Adapted from deepika-builds/liquid-glass.
 * MIT License, Copyright (c) 2026 Deepika Rao.
 * Source: https://github.com/deepika-builds/liquid-glass
 */

export interface LiquidGlassOptions {
  scale?: number;
  chroma?: number;
  border?: number;
  mapBlur?: number;
  blur?: number;
  saturate?: number;
  radius?: number | null;
  fallbackBlur?: number;
}

export interface LiquidGlassInstance {
  supported: boolean;
  refresh: () => void;
  destroy: () => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";

let uid = 0;
let svgDefs: SVGDefsElement | null = null;

function supportsLiquidGlassBackdrop() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) return false;

  if (!window.CSS?.supports("backdrop-filter", "url(#lg)")) return false;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    canvas.getContext("2d")?.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

function ensureDefs() {
  if (svgDefs) return svgDefs;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.width = "0";
  svg.style.height = "0";
  svg.style.overflow = "hidden";

  svgDefs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(svgDefs);
  document.body.appendChild(svg);

  return svgDefs;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeMap(
  width: number,
  height: number,
  radius: number,
  border: number,
  mapBlur: number,
) {
  const w = Math.max(1, Math.round(Math.min(width, 960)));
  const h = Math.max(1, Math.round(Math.min(height, 960)));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);

  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,0,255)");
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "source-over";
  const inset = border * Math.min(w, h);
  ctx.filter = `blur(${mapBlur}px)`;
  ctx.fillStyle = "rgba(128,128,128,0.93)";
  roundedRectPath(
    ctx,
    inset,
    inset,
    Math.max(1, w - inset * 2),
    Math.max(1, h - inset * 2),
    Math.max(radius - inset, 2),
  );
  ctx.fill();
  ctx.filter = "none";

  return canvas.toDataURL();
}

function buildFilter(id: string, scales: number[]) {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("result", "map");
  feImage.setAttribute("preserveAspectRatio", "none");
  filter.appendChild(feImage);

  const keep = [
    "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
  ];
  const channels: string[] = [];

  for (let i = 0; i < 3; i += 1) {
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(scales[i]));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "B");
    disp.setAttribute("result", `d${i}`);
    filter.appendChild(disp);

    const cm = document.createElementNS(SVG_NS, "feColorMatrix");
    cm.setAttribute("in", `d${i}`);
    cm.setAttribute("type", "matrix");
    cm.setAttribute("values", keep[i] ?? keep[0]);
    cm.setAttribute("result", `c${i}`);
    filter.appendChild(cm);
    channels.push(`c${i}`);
  }

  const blend1 = document.createElementNS(SVG_NS, "feBlend");
  blend1.setAttribute("in", channels[0] ?? "c0");
  blend1.setAttribute("in2", channels[1] ?? "c1");
  blend1.setAttribute("mode", "screen");
  blend1.setAttribute("result", "c01");
  filter.appendChild(blend1);

  const blend2 = document.createElementNS(SVG_NS, "feBlend");
  blend2.setAttribute("in", "c01");
  blend2.setAttribute("in2", channels[2] ?? "c2");
  blend2.setAttribute("mode", "screen");
  filter.appendChild(blend2);

  ensureDefs().appendChild(filter);
  return { filter, feImage };
}

function resolveRadius(
  el: HTMLElement,
  width: number,
  height: number,
  override: number | null | undefined,
) {
  if (override != null) return override;
  const raw = getComputedStyle(el).borderTopLeftRadius || "0px";
  const value = parseFloat(raw) || 0;
  return raw.trim().endsWith("%") ? (value / 100) * Math.min(width, height) : value;
}

function setBackdropFilter(el: HTMLElement, value: string) {
  el.style.backdropFilter = value;
  (
    el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
  ).webkitBackdropFilter = value;
}

export function applyLiquidGlass(
  el: HTMLElement,
  options: LiquidGlassOptions = {},
): LiquidGlassInstance {
  const opts = {
    scale: -112,
    chroma: 6,
    border: 0.07,
    mapBlur: 12,
    blur: 3,
    saturate: 1.5,
    radius: null,
    fallbackBlur: 16,
    ...options,
  };
  const previousBackdrop = el.style.backdropFilter;
  const previousWebkitBackdrop = (
    el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
  ).webkitBackdropFilter ?? "";

  el.classList.add("liquid-glass-surface");

  if (!supportsLiquidGlassBackdrop()) {
    setBackdropFilter(el, `blur(${opts.fallbackBlur}px) saturate(${opts.saturate})`);
    el.classList.add("liquid-glass-fallback");

    return {
      supported: false,
      refresh: () => {},
      destroy: () => {
        el.classList.remove("liquid-glass-surface", "liquid-glass-fallback");
        el.style.backdropFilter = previousBackdrop;
        (
          el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
        ).webkitBackdropFilter = previousWebkitBackdrop;
      },
    };
  }

  const id = `lg-filter-${++uid}`;
  const scales = [opts.scale, opts.scale + opts.chroma, opts.scale + opts.chroma * 2];
  const parts = buildFilter(id, scales);

  function refresh() {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (!width || !height) return;

    const radius = resolveRadius(el, width, height, opts.radius);
    const map = makeMap(width, height, radius, opts.border, opts.mapBlur);
    if (!map) return;

    parts.feImage.setAttribute("href", map);
    parts.feImage.setAttribute("width", String(width));
    parts.feImage.setAttribute("height", String(height));
  }

  refresh();
  setBackdropFilter(el, `url(#${id}) blur(${opts.blur}px) saturate(${opts.saturate})`);

  let timer: number | undefined;
  const scheduleRefresh = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, 120);
  };

  const observer =
    "ResizeObserver" in window ? new ResizeObserver(scheduleRefresh) : null;
  observer?.observe(el);
  if (!observer) window.addEventListener("resize", scheduleRefresh);

  return {
    supported: true,
    refresh,
    destroy: () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", scheduleRefresh);
      window.clearTimeout(timer);
      parts.filter.remove();
      el.classList.remove("liquid-glass-surface");
      el.style.backdropFilter = previousBackdrop;
      (
        el.style as CSSStyleDeclaration & { webkitBackdropFilter?: string }
      ).webkitBackdropFilter = previousWebkitBackdrop;
    },
  };
}
