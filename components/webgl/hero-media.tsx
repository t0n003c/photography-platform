"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { cn } from "@/src/lib/utils";
import { useWebGLEnhancement } from "./feature";
import type { PhotoDTO } from "@/src/db/queries/photos";

// The WebGL canvases are their own chunks, client-only, never SSR'd.
const HeroCanvas = dynamic(() => import("./hero-canvas"), { ssr: false });
const DistortionCanvas = dynamic(() => import("./distortion-canvas"), {
  ssr: false,
});

// Pick a broadly-decodable texture (WebP/JPEG, large) for the WebGL sampler.
function bestTextureUrl(photo: PhotoDTO): string | null {
  for (const format of ["webp", "jpeg"]) {
    for (const bucket of ["xlarge", "large", "medium"]) {
      const v = photo.variants.find(
        (x) => x.format === format && x.sizeBucket === bucket,
      );
      if (v) return v.url;
    }
  }
  return photo.variants.at(-1)?.url ?? null;
}

/**
 * Hero with progressive WebGL enhancement. The static <picture> is always the
 * LCP and the complete fallback; the canvas mounts only when the enhancement
 * gate passes and the hero is in view, then fades in. It is pointer-events-none
 * and aria-hidden so it never affects interaction or a11y.
 */
export function HeroMedia({
  photo,
  className,
  children,
  variant = "parallax",
  focalX = 0.5,
  focalY = 0.5,
}: {
  photo: PhotoDTO;
  className?: string;
  children?: React.ReactNode;
  // "parallax" = the default depth-of-field treatment; "distort" = the
  // pointer-driven HTML→WebGL distortion (banner effect=webgl-distortion).
  variant?: "parallax" | "distort";
  // Focal point 0..1 (object-position) so the WebGL crop matches the static img.
  focalX?: number;
  focalY?: number;
}) {
  const enabled = useWebGLEnhancement();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const src = bestTextureUrl(photo);
  const showCanvas = enabled && inView && !!src;

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <ResponsiveImage
        photo={photo}
        sizes="100vw"
        priority
        className="absolute inset-0 h-full w-full object-cover"
        objectPosition={`${focalX * 100}% ${focalY * 100}%`}
      />
      {showCanvas && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 transition-opacity duration-700",
            ready ? "opacity-100" : "opacity-0",
          )}
        >
          {variant === "distort" ? (
            <DistortionCanvas
              src={src}
              onReady={() => setReady(true)}
              focalX={focalX}
              focalY={focalY}
            />
          ) : (
            <HeroCanvas src={src} onReady={() => setReady(true)} />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
