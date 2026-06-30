"use client";

import * as React from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { useWebGLEnhancement } from "@/components/webgl/feature";
import { cn } from "@/src/lib/utils";
import { JustifiedGrid } from "./grids";

const BUCKETS = ["large", "medium", "small"];
const MAX_PLANES = 18;
const PLANE_GAP = 5;

interface DepthItem {
  photo: PhotoDTO;
  url: string;
  aspect: number;
  originalIndex: number;
  color: string;
  mood: DepthMood;
}

interface DepthMood {
  background: string;
  blob1: string;
  blob2: string;
}

export type DepthGalleryLabelStyle = "color-chip" | "metadata" | "minimal";
export type DepthGalleryScrollSpeed = "slow" | "normal" | "fast";

interface DepthGalleryProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  useMoodBackground?: boolean;
  showTrail?: boolean;
  showParticles?: boolean;
  labelStyle?: DepthGalleryLabelStyle;
  scrollSpeed?: DepthGalleryScrollSpeed;
  backgroundColor?: string;
  onOpen: (index: number) => void;
}

function pickVariant(photo: PhotoDTO): { url: string; aspect: number } | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) {
      return {
        url: match.url,
        aspect: match.height ? match.width / match.height : 1,
      };
    }
  }
  const fallback = webp[0] ?? photo.variants[0];
  return fallback
    ? {
        url: fallback.url,
        aspect: fallback.height ? fallback.width / fallback.height : 1,
      }
    : null;
}

function normalizeHex(value: string | null | undefined, fallback = "#fffaf0") {
  if (!value) return fallback;
  const trimmed = value.trim();
  return /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const rp = r / 255;
  const gp = g / 255;
  const bp = b / 255;
  const max = Math.max(rp, gp, bp);
  const min = Math.min(rp, gp, bp);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === rp) hue = ((gp - bp) / delta) % 6;
    else if (max === gp) hue = (bp - rp) / delta + 2;
    else hue = (rp - gp) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  return { h: hue, s: saturation, l: lightness };
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360;
  const s = THREE.MathUtils.clamp(saturation, 0, 1);
  const l = THREE.MathUtils.clamp(lightness, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(rp)}${toHex(gp)}${toHex(bp)}`;
}

function moodFromAccent(hex: string): DepthMood {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  const isLightAccent = luminance > 0.62;
  const isMutedAccent = hsl.s < 0.18;
  const backgroundLightness = isLightAccent
    ? 0.96
    : isMutedAccent
      ? THREE.MathUtils.clamp(hsl.l + 0.24, 0.52, 0.78)
      : THREE.MathUtils.clamp(hsl.l + 0.18, 0.54, 0.72);

  return {
    background: hslToHex(
      hsl.h,
      isLightAccent ? hsl.s * 0.16 : THREE.MathUtils.clamp(hsl.s * 0.34, 0.2, 0.44),
      backgroundLightness,
    ),
    blob1: hslToHex(
      hsl.h + 12,
      THREE.MathUtils.clamp(hsl.s * 0.78, 0.34, 0.86),
      THREE.MathUtils.clamp(hsl.l + 0.18, 0.56, 0.82),
    ),
    blob2: hslToHex(
      hsl.h + 48,
      THREE.MathUtils.clamp(hsl.s * 0.58, 0.28, 0.76),
      THREE.MathUtils.clamp(hsl.l + 0.26, 0.62, 0.86),
    ),
  };
}

function rgbToApproxCmyk(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  if (r === 0 && g === 0 && b === 0) return "0 0 0 100";
  const rp = r / 255;
  const gp = g / 255;
  const bp = b / 255;
  const k = 1 - Math.max(rp, gp, bp);
  const c = Math.round(((1 - rp - k) / (1 - k)) * 100);
  const m = Math.round(((1 - gp - k) / (1 - k)) * 100);
  const y = Math.round(((1 - bp - k) / (1 - k)) * 100);
  return `${c} ${m} ${y} ${Math.round(k * 100)}`;
}

function readableTextColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#171717" : "#f4f4f4";
}

function blendHex(a: string, b: string, amount: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = THREE.MathUtils.clamp(amount, 0, 1);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${toHex(THREE.MathUtils.lerp(ca.r, cb.r, t))}${toHex(
    THREE.MathUtils.lerp(ca.g, cb.g, t),
  )}${toHex(THREE.MathUtils.lerp(ca.b, cb.b, t))}`;
}

function blendMood(a: DepthMood, b: DepthMood, amount: number): DepthMood {
  return {
    background: blendHex(a.background, b.background, amount),
    blob1: blendHex(a.blob1, b.blob1, amount),
    blob2: blendHex(a.blob2, b.blob2, amount),
  };
}

function titleFor(photo: PhotoDTO, fallback: string) {
  return photo.headline?.trim() || photo.altText?.trim() || fallback;
}

function subheadFor(photo: PhotoDTO, fallback?: string | null) {
  return photo.subhead?.trim() || fallback?.trim() || "";
}

function captionFor(photo: PhotoDTO) {
  return photo.caption?.trim() || photo.altText?.trim() || "";
}

function speedToHeight(
  speed: DepthGalleryScrollSpeed,
  count: number,
  isMobile: boolean,
) {
  const multiplier = isMobile
    ? speed === "slow"
      ? 48
      : speed === "fast"
        ? 28
        : 36
    : speed === "slow"
      ? 76
      : speed === "fast"
        ? 46
        : 60;
  return (isMobile ? 92 : 115) + count * multiplier;
}

function StaticFallback({
  items,
  onOpen,
}: {
  items: DepthItem[];
  onOpen: (index: number) => void;
}) {
  return (
    <div className="px-4 py-12">
      <JustifiedGrid
        photos={items.map((item) => item.photo)}
        spacingClass="gap-2 md:gap-3"
        onOpen={(index) => onOpen(items[index]?.originalIndex ?? index)}
      />
    </div>
  );
}

function DepthPlane({
  item,
  index,
  count,
  pointer,
}: {
  item: DepthItem;
  index: number;
  count: number;
  pointer: React.MutableRefObject<THREE.Vector2>;
}) {
  const texture = useLoader(THREE.TextureLoader, item.url);
  const meshRef = React.useRef<THREE.Mesh>(null);
  const materialRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const { viewport, size } = useThree();

  React.useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.minFilter = THREE.LinearFilter;
  }, [texture]);

  useFrame((state) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    const mobile = size.width < 768;
    const xSpread = mobile ? 0.28 : 1;
    const baseX = (index % 2 === 0 ? -0.9 : 0.9) * xSpread;
    const baseY = index % 3 === 0 ? 0.22 : index % 3 === 1 ? -0.18 : 0.04;
    const planeZ = -index * PLANE_GAP;
    const cameraDepth = THREE.MathUtils.clamp(
      (6 - state.camera.position.z) / PLANE_GAP,
      0,
      Math.max(0, count - 1),
    );
    const depthInfluence = THREE.MathUtils.clamp(
      1 - Math.abs(index - cameraDepth) / 2.15,
      0,
      1,
    );
    const blend = THREE.MathUtils.clamp(cameraDepth - Math.floor(cameraDepth), 0, 1);
    const currentIndex = Math.floor(cameraDepth);
    const nextIndex = Math.min(currentIndex + 1, count - 1);
    let targetOpacity = 0;
    if (index === currentIndex) targetOpacity = 1 - blend;
    if (index === nextIndex) targetOpacity = Math.max(targetOpacity, blend);
    const velocityBreath = Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.025;
    const parallaxX = pointer.current.x * 0.16 * depthInfluence * xSpread;
    const parallaxY = pointer.current.y * 0.08 * depthInfluence;
    mesh.position.set(baseX + parallaxX, baseY + parallaxY, planeZ);
    mesh.rotation.set(
      pointer.current.y * 0.035 * depthInfluence + velocityBreath,
      -pointer.current.x * 0.055 * depthInfluence,
      0,
    );
    material.opacity += (targetOpacity - material.opacity) * 0.18;
    const scale = mobile ? 0.68 : 1;
    const width = Math.min(viewport.width * (mobile ? 0.72 : 0.34), 3.6) * scale;
    const height = width / Math.max(0.45, item.aspect);
    mesh.scale.set(width, height, 1);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -index * PLANE_GAP]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        opacity={index === 0 ? 1 : 0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function DepthScene({
  items,
  progress,
  pointer,
}: {
  items: DepthItem[];
  progress: React.MutableRefObject<number>;
  pointer: React.MutableRefObject<THREE.Vector2>;
}) {
  useFrame((state) => {
    const targetZ = 6 - progress.current * Math.max(0, items.length - 1) * PLANE_GAP;
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.08;
    state.camera.position.x += (pointer.current.x * 0.18 - state.camera.position.x) * 0.08;
    state.camera.position.y += (pointer.current.y * 0.08 - state.camera.position.y) * 0.08;
    state.camera.lookAt(0, 0, state.camera.position.z - 6);
  });

  return (
    <React.Suspense fallback={null}>
      {items.map((item, index) => (
        <DepthPlane
          key={item.photo.id}
          item={item}
          index={index}
          count={items.length}
          pointer={pointer}
        />
      ))}
    </React.Suspense>
  );
}

function ParticleField({
  activeColor,
  hidden,
}: {
  activeColor: string;
  hidden: boolean;
}) {
  const particles = React.useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        id: index,
        x: 44 + Math.sin(index * 1.7) * 6,
        delay: `${index * 90}ms`,
        size: 3 + (index % 4),
      })),
    [],
  );
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-20 transition-opacity duration-500",
        hidden && "opacity-0",
      )}
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute rounded-full opacity-70 blur-[0.2px] [animation:depth-particle_2.6s_ease-in-out_infinite]"
          style={{
            left: `${particle.x}%`,
            top: `${18 + particle.id * 5}%`,
            width: particle.size,
            height: particle.size,
            backgroundColor: activeColor,
            animationDelay: particle.delay,
          }}
        />
      ))}
    </div>
  );
}

type DepthTrailPoint = {
  x: number;
  y: number;
};

const TRAIL_TAU = Math.PI * 2;

function depthTrailHead(progress: number, isMobile: boolean, clampProgress = true): DepthTrailPoint {
  const clamped = clampProgress ? THREE.MathUtils.clamp(progress, 0, 1) : progress;
  const horizontalWidth = isMobile ? 13 : 31;
  const startXOffset = isMobile ? 4 : 0;
  return {
    x:
      50 +
      startXOffset +
      Math.sin(clamped * TRAIL_TAU * 1.85) * horizontalWidth +
      Math.sin(clamped * TRAIL_TAU * 0.42 + 0.8) * (isMobile ? 2 : 4),
    y:
      50 +
      Math.sin(clamped * TRAIL_TAU * 2.1) * (isMobile ? 19 : 27) +
      Math.sin(clamped * TRAIL_TAU * 0.7 + 1.4) * (isMobile ? 3 : 5),
  };
}

function smoothTrailPath(points: DepthTrailPoint[]) {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
  }

  const tension = 0.67;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const previous = points[index - 1];
    const beforePrevious = points[index - 2] ?? previous;
    const next = points[index + 1] ?? point;
    const cp1 = {
      x: previous.x + ((point.x - beforePrevious.x) / 6) * tension,
      y: previous.y + ((point.y - beforePrevious.y) / 6) * tension,
    };
    const cp2 = {
      x: point.x - ((next.x - previous.x) / 6) * tension,
      y: point.y - ((next.y - previous.y) / 6) * tension,
    };
    return `${path} C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

function DepthTrail({
  progress,
  color,
  isMobile,
}: {
  progress: number;
  color: string;
  isMobile: boolean;
}) {
  const points = React.useMemo(() => {
    const pointCount = isMobile ? 34 : 42;
    const span = isMobile ? 0.34 : 0.42;
    const sampled = Array.from({ length: pointCount }, (_, index) => {
      const amount = index / Math.max(1, pointCount - 1);
      const easedAmount = 1 - Math.pow(1 - amount, 1.35);
      return depthTrailHead(progress - span + span * easedAmount, isMobile, false);
    });

    return sampled.reduce<DepthTrailPoint[]>((smoothedPoints, point, index) => {
      if (index === 0) return [point];
      const previous = smoothedPoints[smoothedPoints.length - 1];
      smoothedPoints.push({
        x: previous.x + (point.x - previous.x) * 0.53,
        y: previous.y + (point.y - previous.y) * 0.53,
      });
      return smoothedPoints;
    }, []);
  }, [progress, isMobile]);

  const d = smoothTrailPath(points);
  const head = points[points.length - 1];
  const edgeVisibility = THREE.MathUtils.smoothstep(
    Math.min(progress + 0.1, 1 - progress),
    0.04,
    0.2,
  );
  const opacity = 0.36 + edgeVisibility * 0.28;

  return (
    <svg
      data-depth-trail="true"
      className="pointer-events-none absolute inset-0 z-20 h-full w-full opacity-75"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="0.86"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity * 0.22}
        filter="url(#depthTrailBlur)"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="0.24"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
      {head && <circle cx={head.x} cy={head.y} r="0.48" fill={color} opacity={opacity} />}
      <defs>
        <filter id="depthTrailBlur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="1.15" />
        </filter>
      </defs>
    </svg>
  );
}

function DepthLabels({
  item,
  index,
  count,
  labelStyle,
  textColor,
}: {
  item: DepthItem;
  index: number;
  count: number;
  labelStyle: DepthGalleryLabelStyle;
  textColor: string;
}) {
  const title = titleFor(item.photo, `Frame ${index + 1}`);
  const subhead = subheadFor(item.photo);
  const caption = captionFor(item.photo);
  const rgb = hexToRgb(item.color);

  if (labelStyle === "minimal") {
    return (
      <div
        className="pointer-events-none absolute inset-x-4 bottom-6 z-40 flex items-end justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.08em] md:inset-x-6"
        style={{ color: textColor }}
      >
        <p className="m-0">{String(index + 1).padStart(2, "0")}</p>
        <p className="m-0 max-w-[60vw] text-right">{title}</p>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors duration-500"
      style={{ color: textColor }}
    >
      <div className="absolute left-4 top-[18%] grid gap-3 md:left-[8vw] md:top-1/2">
        <p className="m-0">{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</p>
        <p className="m-0 max-w-[11rem] text-[11px] leading-tight md:max-w-[16rem]">
          {title}
        </p>
        <span
          className="block h-5 w-5 rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
      </div>
      <article className="absolute bottom-8 right-4 grid w-auto max-w-[min(72vw,24rem)] justify-items-end text-right leading-tight md:bottom-auto md:right-[7vw] md:top-1/2 md:-translate-y-1/2">
        {labelStyle === "metadata" ? (
          <>
            <p className="m-0 text-[11px]">{subhead || title}</p>
            {caption && <p className="m-0 normal-case tracking-normal opacity-80">{caption}</p>}
          </>
        ) : (
          <dl className="m-0 inline-grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-left leading-none">
            <div className="contents">
              <dt className="opacity-70">CMYK</dt>
              <dd className="m-0">{rgbToApproxCmyk(item.color)}</dd>
            </div>
            <div className="contents">
              <dt className="opacity-70">RGB</dt>
              <dd className="m-0">{rgb.r} {rgb.g} {rgb.b}</dd>
            </div>
            <div className="contents">
              <dt className="opacity-70">HEX</dt>
              <dd className="m-0">{item.color.toUpperCase()}</dd>
            </div>
            <div className="contents">
              <dt className="opacity-70">TEXT</dt>
              <dd className="m-0">{subhead || "PHOTO TONE"}</dd>
            </div>
          </dl>
        )}
      </article>
    </div>
  );
}

/**
 * Codrops DepthGallery adaptation. Intentional deviations: the reference uses a
 * raw Three engine + custom GLSL background; this app uses React Three Fiber,
 * CSS mood blobs, selected gallery photos, and a static reduced-motion fallback.
 */
export function DepthGallery({
  photos,
  title,
  subtitle,
  useMoodBackground = true,
  showTrail = true,
  showParticles = true,
  labelStyle = "color-chip",
  scrollSpeed = "normal",
  backgroundColor = "#fffaf0",
  onOpen,
}: DepthGalleryProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const progress = React.useRef(0);
  const pointer = React.useRef(new THREE.Vector2(0, 0));
  const enhanced = useWebGLEnhancement();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visualProgress, setVisualProgress] = React.useState(0);
  const [isMobile, setIsMobile] = React.useState(false);

  const items = React.useMemo<DepthItem[]>(
    () =>
      photos
        .map((photo, originalIndex) => {
          const variant = pickVariant(photo);
          if (!variant) return null;
          const color = normalizeHex(photo.dominantColor, "#fffaf0");
          return {
            photo,
            url: variant.url,
            aspect: variant.aspect,
            originalIndex,
            color,
            mood: moodFromAccent(color),
          };
        })
        .filter((item): item is DepthItem => Boolean(item))
        .slice(0, MAX_PLANES),
    [photos],
  );

  React.useEffect(() => {
    const onScroll = () => {
      const root = rootRef.current;
      if (!root) return;
      const rect = root.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const nextProgress = THREE.MathUtils.clamp(-rect.top / range, 0, 1);
      progress.current = nextProgress;
      setVisualProgress(nextProgress);
      setActiveIndex((prev) => {
        const next = Math.round(progress.current * Math.max(0, items.length - 1));
        return next === prev ? prev : next;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items.length]);

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointer.current.set(
        (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1,
        -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1),
      );
    };
    const reset = () => pointer.current.set(0, 0);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", reset);
    };
  }, []);

  if (items.length === 0) return null;
  if (!enhanced || items.length < 2) {
    return <StaticFallback items={items} onOpen={onOpen} />;
  }

  const active = items[activeIndex] ?? items[0];
  const next = items[Math.min(items.length - 1, activeIndex + 1)] ?? active;
  const blend = progress.current * Math.max(0, items.length - 1) - activeIndex;
  const mood = useMoodBackground
    ? blendMood(active.mood, next.mood, Math.max(0, blend))
    : {
        background: backgroundColor,
        blob1: backgroundColor,
        blob2: backgroundColor,
      };
  const moodColor = mood.background;
  const textColor = readableTextColor(moodColor);
  const scrollHeight = speedToHeight(scrollSpeed, items.length, isMobile);
  const heroTitle = title || "Depth Gallery";
  const heroSubtitle = subtitle || "Atmospheric photo sequence";

  return (
    <section
      ref={rootRef}
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{ height: `${scrollHeight}vh` }}
      data-depth-gallery
    >
      <div className="sticky top-0 h-[100svh] min-h-[640px] overflow-hidden">
        <div
          data-depth-mood-background="true"
          className="absolute inset-0 transition-colors duration-700"
          style={{ backgroundColor: mood.background }}
        />
        <div
          data-depth-mood-blob="true"
          className="absolute inset-0 opacity-80 transition duration-700"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 38%, ${mood.blob1} 0, transparent 34%), radial-gradient(circle at 68% 62%, ${mood.blob2} 0, transparent 36%)`,
            filter: "blur(38px) saturate(1.12)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.09] mix-blend-overlay [background-image:linear-gradient(115deg,transparent_0,rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:13px_13px]" />
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45, near: 0.1, far: 140 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          className="relative z-10"
        >
          <DepthScene items={items} progress={progress} pointer={pointer} />
        </Canvas>
        {showTrail && (
          <DepthTrail
            progress={visualProgress}
            color={textColor}
            isMobile={isMobile}
          />
        )}
        {showParticles && <ParticleField activeColor={textColor} hidden={!showTrail} />}
        <div
          className="pointer-events-none absolute left-4 top-4 z-40 font-mono text-[10px] uppercase tracking-[0.08em] md:left-6 md:top-6"
          style={{ color: textColor }}
        >
          <p className="m-0 font-semibold">{heroTitle}</p>
          <p className="m-0 mt-1 max-w-[22rem] opacity-75">{heroSubtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpen(active.originalIndex)}
          className="absolute inset-0 z-30 cursor-zoom-in bg-transparent"
          aria-label={`Open ${titleFor(active.photo, "photo")}`}
        />
        <DepthLabels
          item={active}
          index={activeIndex}
          count={items.length}
          labelStyle={labelStyle}
          textColor={textColor}
        />
      </div>
    </section>
  );
}
