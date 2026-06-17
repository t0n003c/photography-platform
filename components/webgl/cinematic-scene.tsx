"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import type { PhotoDTO } from "@/src/db/queries/photos";

// Scroll-driven 3D fly-through of a photo set. A tall outer container provides
// the scroll distance; a sticky canvas stays pinned while the camera advances
// through planes arranged in depth. Purely visual + opt-in; the normal grid is
// the fallback when WebGL is gated off (see CinematicGallery).

const GAP = 4.2; // z-distance between planes
const PLANE_W = 3.2;

function pickTexture(photo: PhotoDTO): { url: string; aspect: number } | null {
  for (const format of ["webp", "jpeg"]) {
    for (const bucket of ["large", "medium", "xlarge"]) {
      const v = photo.variants.find(
        (x) => x.format === format && x.sizeBucket === bucket,
      );
      if (v) return { url: v.url, aspect: v.height ? v.width / v.height : 1.5 };
    }
  }
  const v = photo.variants.at(-1);
  return v ? { url: v.url, aspect: v.height ? v.width / v.height : 1.5 } : null;
}

function Plane({
  url,
  aspect,
  index,
}: {
  url: string;
  aspect: number;
  index: number;
}) {
  const texture = useLoader(THREE.TextureLoader, url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
  }, [texture]);
  const w = PLANE_W;
  const h = w / Math.max(0.4, aspect);
  // Alternate slight horizontal offset so the path weaves a little.
  const x = (index % 2 === 0 ? -1 : 1) * 1.15;
  const y = (index % 3 === 0 ? 1 : -1) * 0.35;
  return (
    <mesh position={[x, y, -index * GAP]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

function Rig({
  count,
  progress,
}: {
  count: number;
  progress: { current: number };
}) {
  const total = count * GAP;
  useFrame((state) => {
    const targetZ = 5 - progress.current * (total + 2);
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.1;
    state.camera.position.x += (0 - state.camera.position.x) * 0.1;
    state.camera.lookAt(0, 0, state.camera.position.z - 5);
  });
  return null;
}

export default function CinematicScene({ photos }: { photos: PhotoDTO[] }) {
  const items = useMemo(
    () =>
      photos
        .slice(0, 12)
        .map((p) => pickTexture(p))
        .filter((x): x is { url: string; aspect: number } => !!x),
    [photos],
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const progress = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const el = outerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const denom = rect.height - window.innerHeight;
      progress.current = denom > 0 ? Math.min(1, Math.max(0, -rect.top / denom)) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (items.length === 0) return null;
  const heightVh = 110 + items.length * 32;

  return (
    <div ref={outerRef} style={{ height: `${heightVh}vh` }} className="relative">
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 60 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            {items.map((it, i) => (
              <Plane key={i} url={it.url} aspect={it.aspect} index={i} />
            ))}
            <Rig count={items.length} progress={progress} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
