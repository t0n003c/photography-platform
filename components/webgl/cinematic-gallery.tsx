"use client";

import dynamic from "next/dynamic";
import { Gallery } from "@/components/gallery/gallery";
import { useWebGLEnhancement } from "./feature";
import type { PhotoDTO } from "@/src/db/queries/photos";

const CinematicScene = dynamic(() => import("./cinematic-scene"), { ssr: false });

interface Layout {
  gridType: "masonry" | "justified" | "uniform";
  spacing?: string;
}

// Gallery with the opt-in cinematic 3D-scroll effect. Renders the standard
// responsive grid until the WebGL enhancement gate passes (reduced-motion/data,
// WebGL support, idle), then upgrades to the scroll-driven 3D fly-through. The
// grid is always the complete, accessible fallback.
export function CinematicGallery({
  photos,
  layout,
  speed = 1,
}: {
  photos: PhotoDTO[];
  layout: Layout;
  speed?: number;
}) {
  const enabled = useWebGLEnhancement();
  if (!enabled) return <Gallery photos={photos} layout={layout} />;
  return <CinematicScene photos={photos} speed={speed} />;
}
