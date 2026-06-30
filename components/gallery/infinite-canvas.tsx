"use client";

import * as React from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { cn } from "@/src/lib/utils";
import { useWebGLEnhancement } from "@/components/webgl/feature";
import { JustifiedGrid } from "./grids";

const BUCKETS = ["medium", "large", "small"];
const CHUNK_SIZE = 110;
const RENDER_DISTANCE = 2;
const CHUNK_FADE_MARGIN = 1;
const DEPTH_FADE_START = 130;
const DEPTH_FADE_END = 280;
const INITIAL_CAMERA_Z = 48;
const INVIS_THRESHOLD = 0.01;
const VELOCITY_LERP = 0.16;
const VELOCITY_DECAY = 0.9;
const KEYBOARD_SPEED = 0.18;
const GEOMETRY = new THREE.PlaneGeometry(1, 1);
const DEFAULT_LIGHT_BACKGROUND = "#f4f1ea";
const DEFAULT_DARK_BACKGROUND = "#0d0d0c";
const DEFAULT_DARK_FOG = "#11110f";

export type InfiniteCanvasDensity = "sparse" | "normal" | "dense";
export type InfiniteCanvasImageSize = "small" | "medium" | "large";
export type InfiniteCanvasMovement = "slow" | "normal" | "fast";
type InfiniteCanvasColorMode = "light" | "dark";

interface InfiniteCanvasProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  backgroundColor?: string;
  fogColor?: string;
  density?: InfiniteCanvasDensity;
  imageSize?: InfiniteCanvasImageSize;
  movement?: InfiniteCanvasMovement;
  showControls?: boolean;
  enableKeyboard?: boolean;
  onOpen: (index: number) => void;
}

interface CanvasItem {
  photo: PhotoDTO;
  url: string;
  width: number;
  height: number;
  originalIndex: number;
}

interface PlaneData {
  id: string;
  position: [number, number, number];
  size: number;
  mediaIndex: number;
}

interface ChunkData {
  key: string;
  cx: number;
  cy: number;
  cz: number;
}

interface CameraGridState {
  cx: number;
  cy: number;
  cz: number;
  z: number;
}

interface ControllerState {
  velocity: { x: number; y: number; z: number };
  targetVelocity: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  drift: { x: number; y: number };
  mouse: { x: number; y: number };
  lastPointer: { x: number; y: number };
  isDragging: boolean;
  scrollDelta: number;
  lastTouchDistance: number;
  lastChunkKey: string;
  lastChunkUpdate: number;
}

interface SceneSettings {
  density: InfiniteCanvasDensity;
  imageSize: InfiniteCanvasImageSize;
  movement: InfiniteCanvasMovement;
  showControls: boolean;
  enableKeyboard: boolean;
  backgroundColor: string;
  fogColor: string;
}

const CHUNK_OFFSETS = (() => {
  const offsets: Array<{ dx: number; dy: number; dz: number; dist: number }> = [];
  const max = RENDER_DISTANCE + CHUNK_FADE_MARGIN;
  for (let dx = -max; dx <= max; dx += 1) {
    for (let dy = -max; dy <= max; dy += 1) {
      for (let dz = -max; dz <= max; dz += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
        if (dist <= max) offsets.push({ dx, dy, dz, dist });
      }
    }
  }
  return offsets.sort((a, b) => a.dist - b.dist);
})();

function pickVariant(photo: PhotoDTO): CanvasItem | null {
  const webp = photo.variants.filter((v) => v.format === "webp");
  for (const bucket of BUCKETS) {
    const match = webp.find((v) => v.sizeBucket === bucket);
    if (match) {
      return {
        photo,
        url: match.url,
        width: match.width,
        height: match.height,
        originalIndex: 0,
      };
    }
  }
  const fallback = webp[0] ?? photo.variants[0];
  return fallback
    ? {
        photo,
        url: fallback.url,
        width: fallback.width,
        height: fallback.height,
        originalIndex: 0,
      }
    : null;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function densityCount(density: InfiniteCanvasDensity) {
  if (density === "sparse") return 4;
  if (density === "dense") return 7;
  return 5;
}

function sizeRange(size: InfiniteCanvasImageSize) {
  if (size === "small") return { min: 11, span: 8 };
  if (size === "large") return { min: 18, span: 12 };
  return { min: 14, span: 10 };
}

function movementScale(movement: InfiniteCanvasMovement) {
  if (movement === "slow") return 0.72;
  if (movement === "fast") return 1.28;
  return 1;
}

function normalizeColor(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function resolveThemeColor(
  value: string,
  mode: InfiniteCanvasColorMode,
  darkValue: string,
) {
  if (mode !== "dark") return value;
  return normalizeColor(value) === DEFAULT_LIGHT_BACKGROUND ? darkValue : value;
}

function useInfiniteCanvasColorMode(): InfiniteCanvasColorMode {
  const [mode, setMode] = React.useState<InfiniteCanvasColorMode>("light");

  React.useEffect(() => {
    const update = () => {
      setMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    };
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return mode;
}

function generateChunkPlanes(
  cx: number,
  cy: number,
  cz: number,
  density: InfiniteCanvasDensity,
  imageSize: InfiniteCanvasImageSize,
): PlaneData[] {
  const count = densityCount(density);
  const range = sizeRange(imageSize);
  const seed = hashString(`${cx},${cy},${cz},${density},${imageSize}`);
  const planes: PlaneData[] = [];

  for (let i = 0; i < count; i += 1) {
    const base = seed + i * 1009;
    const rx = seededRandom(base + 1);
    const ry = seededRandom(base + 2);
    const rz = seededRandom(base + 3);
    const rs = seededRandom(base + 4);
    const rm = seededRandom(base + 5);
    planes.push({
      id: `${cx}:${cy}:${cz}:${i}`,
      position: [
        cx * CHUNK_SIZE + rx * CHUNK_SIZE - CHUNK_SIZE * 0.5,
        cy * CHUNK_SIZE + ry * CHUNK_SIZE - CHUNK_SIZE * 0.5,
        cz * CHUNK_SIZE + rz * CHUNK_SIZE - CHUNK_SIZE * 0.5,
      ],
      size: range.min + rs * range.span,
      mediaIndex: Math.floor(rm * 1_000_000),
    });
  }

  return planes;
}

function createInitialState(): ControllerState {
  return {
    velocity: { x: 0, y: 0, z: 0 },
    targetVelocity: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: INITIAL_CAMERA_Z },
    drift: { x: 0, y: 0 },
    mouse: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0 },
    isDragging: false,
    scrollDelta: 0,
    lastTouchDistance: 0,
    lastChunkKey: "",
    lastChunkUpdate: 0,
  };
}

function touchDistance(touches: TouchList) {
  if (touches.length < 2) return 0;
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function MediaPlane({
  plane,
  item,
  chunk,
  cameraGridRef,
  onOpen,
  clickGuardRef,
}: {
  plane: PlaneData;
  item: CanvasItem;
  chunk: { cx: number; cy: number; cz: number };
  cameraGridRef: React.RefObject<CameraGridState>;
  onOpen: (index: number) => void;
  clickGuardRef: React.RefObject<number>;
}) {
  const meshRef = React.useRef<THREE.Mesh>(null);
  const materialRef = React.useRef<THREE.MeshBasicMaterial>(null);
  const opacityRef = React.useRef(0);
  const texture = useLoader(THREE.TextureLoader, item.url);

  React.useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    const mesh = meshRef.current;
    const cameraGrid = cameraGridRef.current;
    if (!material || !mesh) return;

    const chunkDistance = Math.max(
      Math.abs(chunk.cx - cameraGrid.cx),
      Math.abs(chunk.cy - cameraGrid.cy),
      Math.abs(chunk.cz - cameraGrid.cz),
    );
    const depthDistance = Math.abs(plane.position[2] - cameraGrid.z);
    const gridFade =
      chunkDistance <= RENDER_DISTANCE
        ? 1
        : Math.max(0, 1 - (chunkDistance - RENDER_DISTANCE) / CHUNK_FADE_MARGIN);
    const depthFade =
      depthDistance <= DEPTH_FADE_START
        ? 1
        : Math.max(0, 1 - (depthDistance - DEPTH_FADE_START) / (DEPTH_FADE_END - DEPTH_FADE_START));
    const targetOpacity = Math.min(gridFade, depthFade * depthFade);
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 0.18);

    const wave = Math.sin(clock.elapsedTime * 0.42 + plane.mediaIndex) * 0.012;
    mesh.rotation.z = wave;
    material.opacity = opacityRef.current;
    material.depthWrite = opacityRef.current > 0.98;
    mesh.visible = opacityRef.current > INVIS_THRESHOLD;
  });

  const aspect = item.height ? item.width / item.height : 1;
  const scale: [number, number, number] = [plane.size * aspect, plane.size, 1];

  return (
    <mesh
      ref={meshRef}
      geometry={GEOMETRY}
      position={plane.position}
      scale={scale}
      visible={false}
      onClick={(event) => {
        event.stopPropagation();
        if (clickGuardRef.current > 8) return;
        onOpen(item.originalIndex);
      }}
    >
      <meshBasicMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Chunk({
  chunk,
  items,
  settings,
  cameraGridRef,
  onOpen,
  clickGuardRef,
}: {
  chunk: ChunkData;
  items: CanvasItem[];
  settings: SceneSettings;
  cameraGridRef: React.RefObject<CameraGridState>;
  onOpen: (index: number) => void;
  clickGuardRef: React.RefObject<number>;
}) {
  const planes = React.useMemo(
    () =>
      generateChunkPlanes(
        chunk.cx,
        chunk.cy,
        chunk.cz,
        settings.density,
        settings.imageSize,
      ),
    [chunk.cx, chunk.cy, chunk.cz, settings.density, settings.imageSize],
  );

  return (
    <group>
      {planes.map((plane) => {
        const item = items[plane.mediaIndex % items.length];
        if (!item) return null;
        return (
          <MediaPlane
            key={plane.id}
            plane={plane}
            item={item}
            chunk={chunk}
            cameraGridRef={cameraGridRef}
            onOpen={onOpen}
            clickGuardRef={clickGuardRef}
          />
        );
      })}
    </group>
  );
}

function SceneController({
  items,
  settings,
  onOpen,
}: {
  items: CanvasItem[];
  settings: SceneSettings;
  onOpen: (index: number) => void;
}) {
  const { camera, gl } = useThree();
  const stateRef = React.useRef(createInitialState());
  const cameraGridRef = React.useRef<CameraGridState>({
    cx: 0,
    cy: 0,
    cz: 0,
    z: INITIAL_CAMERA_Z,
  });
  const clickGuardRef = React.useRef(0);
  const pressedKeys = React.useRef(new Set<string>());
  const [chunks, setChunks] = React.useState<ChunkData[]>(() =>
    CHUNK_OFFSETS.map((offset) => ({
      key: `${offset.dx},${offset.dy},${offset.dz}`,
      cx: offset.dx,
      cy: offset.dy,
      cz: offset.dz,
    })),
  );

  React.useEffect(() => {
    const canvas = gl.domElement;
    const state = stateRef.current;
    const scale = movementScale(settings.movement);
    canvas.style.cursor = "grab";

    const onPointerDown = (event: PointerEvent) => {
      state.isDragging = true;
      clickGuardRef.current = 0;
      state.lastPointer = { x: event.clientX, y: event.clientY };
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerUp = (event: PointerEvent) => {
      state.isDragging = false;
      canvas.style.cursor = "grab";
      canvas.releasePointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      state.mouse = {
        x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        y: -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      };
      if (!state.isDragging) return;
      const dx = event.clientX - state.lastPointer.x;
      const dy = event.clientY - state.lastPointer.y;
      clickGuardRef.current += Math.abs(dx) + Math.abs(dy);
      state.targetVelocity.x -= dx * 0.025 * scale;
      state.targetVelocity.y += dy * 0.025 * scale;
      state.lastPointer = { x: event.clientX, y: event.clientY };
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      state.scrollDelta += event.deltaY * 0.006 * scale;
    };
    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      state.lastTouchDistance = touchDistance(event.touches);
    };
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      const touch = event.touches.item(0);
      if (event.touches.length === 1 && touch) {
        const last = state.lastPointer;
        if (last.x || last.y) {
          const dx = touch.clientX - last.x;
          const dy = touch.clientY - last.y;
          clickGuardRef.current += Math.abs(dx) + Math.abs(dy);
          state.targetVelocity.x -= dx * 0.02 * scale;
          state.targetVelocity.y += dy * 0.02 * scale;
        }
        state.lastPointer = { x: touch.clientX, y: touch.clientY };
      }
      if (event.touches.length === 2) {
        const distance = touchDistance(event.touches);
        if (state.lastTouchDistance > 0) {
          state.scrollDelta += (state.lastTouchDistance - distance) * 0.007 * scale;
        }
        state.lastTouchDistance = distance;
      }
    };
    const onTouchEnd = () => {
      state.lastPointer = { x: 0, y: 0 };
      state.lastTouchDistance = 0;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!settings.enableKeyboard) return;
      pressedKeys.current.add(event.key.toLowerCase());
    };
    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeys.current.delete(event.key.toLowerCase());
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerUp);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl, settings.enableKeyboard, settings.movement]);

  useFrame(() => {
    const state = stateRef.current;
    const keys = pressedKeys.current;
    const scale = movementScale(settings.movement);
    const keyboardStep = KEYBOARD_SPEED * scale;
    if (settings.enableKeyboard) {
      if (keys.has("w") || keys.has("arrowup")) state.targetVelocity.z -= keyboardStep;
      if (keys.has("s") || keys.has("arrowdown")) state.targetVelocity.z += keyboardStep;
      if (keys.has("a") || keys.has("arrowleft")) state.targetVelocity.x -= keyboardStep;
      if (keys.has("d") || keys.has("arrowright")) state.targetVelocity.x += keyboardStep;
      if (keys.has("q")) state.targetVelocity.y -= keyboardStep;
      if (keys.has("e")) state.targetVelocity.y += keyboardStep;
    }

    const isZooming = Math.abs(state.velocity.z) > 0.05;
    const zoomFactor = THREE.MathUtils.clamp(state.position.z / 50, 0.3, 2);
    const driftAmount = 8 * zoomFactor;
    const driftLerp = isZooming ? 0.2 : 0.12;

    if (!state.isDragging) {
      state.drift.x = THREE.MathUtils.lerp(state.drift.x, state.mouse.x * driftAmount, driftLerp);
      state.drift.y = THREE.MathUtils.lerp(state.drift.y, state.mouse.y * driftAmount, driftLerp);
    }

    state.targetVelocity.z += state.scrollDelta;
    state.scrollDelta *= 0.8;
    const maxVelocity = 3.2 * scale;
    state.targetVelocity.x = THREE.MathUtils.clamp(state.targetVelocity.x, -maxVelocity, maxVelocity);
    state.targetVelocity.y = THREE.MathUtils.clamp(state.targetVelocity.y, -maxVelocity, maxVelocity);
    state.targetVelocity.z = THREE.MathUtils.clamp(state.targetVelocity.z, -maxVelocity, maxVelocity);

    state.velocity.x = THREE.MathUtils.lerp(state.velocity.x, state.targetVelocity.x, VELOCITY_LERP);
    state.velocity.y = THREE.MathUtils.lerp(state.velocity.y, state.targetVelocity.y, VELOCITY_LERP);
    state.velocity.z = THREE.MathUtils.lerp(state.velocity.z, state.targetVelocity.z, VELOCITY_LERP);

    state.position.x += state.velocity.x;
    state.position.y += state.velocity.y;
    state.position.z += state.velocity.z;
    camera.position.set(
      state.position.x + state.drift.x,
      state.position.y + state.drift.y,
      state.position.z,
    );

    state.targetVelocity.x *= VELOCITY_DECAY;
    state.targetVelocity.y *= VELOCITY_DECAY;
    state.targetVelocity.z *= VELOCITY_DECAY;

    const cx = Math.floor(state.position.x / CHUNK_SIZE);
    const cy = Math.floor(state.position.y / CHUNK_SIZE);
    const cz = Math.floor(state.position.z / CHUNK_SIZE);
    cameraGridRef.current = { cx, cy, cz, z: state.position.z };

    const key = `${cx},${cy},${cz}`;
    const now = performance.now();
    const throttle = Math.abs(state.velocity.z) > 1 ? 320 : 90;
    if (key !== state.lastChunkKey && now - state.lastChunkUpdate > throttle) {
      state.lastChunkKey = key;
      state.lastChunkUpdate = now;
      setChunks(
        CHUNK_OFFSETS.map((offset) => ({
          key: `${cx + offset.dx},${cy + offset.dy},${cz + offset.dz}`,
          cx: cx + offset.dx,
          cy: cy + offset.dy,
          cz: cz + offset.dz,
        })),
      );
    }
  });

  return (
    <>
      {chunks.map((chunk) => (
        <Chunk
          key={chunk.key}
          chunk={chunk}
          items={items}
          settings={settings}
          cameraGridRef={cameraGridRef}
          onOpen={onOpen}
          clickGuardRef={clickGuardRef}
        />
      ))}
    </>
  );
}

function InfiniteCanvasScene({
  items,
  settings,
  onOpen,
}: {
  items: CanvasItem[];
  settings: SceneSettings;
  onOpen: (index: number) => void;
}) {
  const [dpr, setDpr] = React.useState(1);

  React.useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setDpr(Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5));
  }, []);

  return (
    <Canvas
      camera={{
        position: [0, 0, INITIAL_CAMERA_Z],
        fov: 60,
        near: 1,
        far: 520,
      }}
      dpr={dpr}
      flat
      gl={{ antialias: false, powerPreference: "high-performance" }}
      className="absolute inset-0"
    >
      <color attach="background" args={[settings.backgroundColor]} />
      <fog attach="fog" args={[settings.fogColor, 120, 330]} />
      <React.Suspense fallback={null}>
        <SceneController items={items} settings={settings} onOpen={onOpen} />
      </React.Suspense>
    </Canvas>
  );
}

function StaticFallback({ photos, onOpen }: { photos: PhotoDTO[]; onOpen: (index: number) => void }) {
  return (
    <div className="px-4 py-10 md:px-8">
      <JustifiedGrid photos={photos} spacingClass="gap-2 md:gap-3" onOpen={onOpen} />
    </div>
  );
}

function controlCopy(enableKeyboard: boolean) {
  return enableKeyboard
    ? "Drag to pan · Scroll or pinch to move · WASD / QE"
    : "Drag to pan · Scroll or pinch to move";
}

export function InfiniteCanvasGallery({
  photos,
  title,
  subtitle,
  backgroundColor = DEFAULT_LIGHT_BACKGROUND,
  fogColor = DEFAULT_LIGHT_BACKGROUND,
  density = "normal",
  imageSize = "medium",
  movement = "normal",
  showControls = true,
  enableKeyboard = true,
  onOpen,
}: InfiniteCanvasProps) {
  const enhanced = useWebGLEnhancement();
  const colorMode = useInfiniteCanvasColorMode();
  const resolvedBackgroundColor = resolveThemeColor(
    backgroundColor,
    colorMode,
    DEFAULT_DARK_BACKGROUND,
  );
  const resolvedFogColor = resolveThemeColor(fogColor, colorMode, DEFAULT_DARK_FOG);
  const items = React.useMemo(
    () =>
      photos
        .map((photo, index) => {
          const item = pickVariant(photo);
          return item ? { ...item, originalIndex: index } : null;
        })
        .filter((item): item is CanvasItem => Boolean(item)),
    [photos],
  );
  const settings = React.useMemo<SceneSettings>(
    () => ({
      backgroundColor: resolvedBackgroundColor,
      fogColor: resolvedFogColor,
      density,
      imageSize,
      movement,
      showControls,
      enableKeyboard,
    }),
    [
      density,
      enableKeyboard,
      imageSize,
      movement,
      resolvedBackgroundColor,
      resolvedFogColor,
      showControls,
    ],
  );

  React.useEffect(() => {
    if (!enhanced || items.length < 2) return;
    const lenis = (window as Window & { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    lenis?.stop();
    return () => lenis?.start();
  }, [enhanced, items.length]);

  if (items.length === 0) return null;
  if (!enhanced || items.length < 2) {
    return <StaticFallback photos={photos} onOpen={onOpen} />;
  }

  return (
    <section
      className="relative left-1/2 h-[100svh] min-h-[620px] w-screen -translate-x-1/2 touch-none overflow-hidden overscroll-none text-neutral-950 dark:text-neutral-50"
      data-infinite-canvas
      style={
        {
          "--infinite-bg": resolvedBackgroundColor,
          "--infinite-fog": resolvedFogColor,
          backgroundColor: resolvedBackgroundColor,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 bg-[var(--infinite-bg)]" />
      <InfiniteCanvasScene items={items} settings={settings} onOpen={onOpen} />

      <div className="pointer-events-none absolute inset-x-4 top-6 z-10 flex items-start justify-between gap-4 text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.8),0_0_2px_rgba(0,0,0,0.95)] md:inset-x-8 md:top-8">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] opacity-70">
            Infinite canvas
          </p>
          <h2 className="mt-2 max-w-[15rem] text-balance text-2xl font-semibold uppercase leading-[0.95] md:max-w-xl md:text-6xl">
            {title || "Explore"}
          </h2>
          {subtitle && (
            <p className="mt-3 max-w-xs text-sm uppercase tracking-[0.18em] opacity-70 md:max-w-md">
              {subtitle}
            </p>
          )}
        </div>
        <div className="hidden max-w-[18rem] text-right text-xs uppercase tracking-[0.18em] opacity-70 md:block">
          {showControls ? controlCopy(enableKeyboard) : `${items.length} photographs`}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex items-end justify-between gap-4 text-white [text-shadow:0_1px_18px_rgba(0,0,0,0.8),0_0_2px_rgba(0,0,0,0.95)] md:inset-x-8 md:bottom-7">
        <p className="max-w-[14rem] text-xs uppercase tracking-[0.18em] opacity-70 md:max-w-sm">
          {items.length} photographs repeated through a navigable image field
        </p>
        {showControls && (
          <p className="text-right text-xs uppercase tracking-[0.18em] opacity-70 md:hidden">
            Drag · Pinch
          </p>
        )}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1]",
          "bg-[radial-gradient(circle_at_50%_50%,transparent_0,transparent_42%,rgba(0,0,0,0.08)_100%)]",
        )}
      />
    </section>
  );
}
