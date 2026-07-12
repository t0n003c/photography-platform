"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/src/lib/utils";
import { applyLiquidGlass, type LiquidGlassOptions } from "@/src/lib/liquid-glass";

interface LiquidGlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  enabled?: boolean;
  options?: LiquidGlassOptions;
  refreshKey?: string | number;
}

export function LiquidGlassSurface({
  enabled = true,
  options,
  refreshKey,
  className,
  children,
  ...props
}: LiquidGlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = options?.scale ?? -112;
  const chroma = options?.chroma ?? 6;
  const border = options?.border ?? 0.07;
  const mapBlur = options?.mapBlur ?? 12;
  const blur = options?.blur ?? 3;
  const saturate = options?.saturate ?? 1.5;
  const radius = options?.radius ?? null;
  const fallbackBlur = options?.fallbackBlur ?? 16;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    const glass = applyLiquidGlass(el, {
      scale,
      chroma,
      border,
      mapBlur,
      blur,
      saturate,
      radius,
      fallbackBlur,
    });
    return () => glass.destroy();
  }, [
    enabled,
    scale,
    chroma,
    border,
    mapBlur,
    blur,
    saturate,
    radius,
    fallbackBlur,
    refreshKey,
  ]);

  return (
    <div ref={ref} className={cn("liquid-glass-react-surface", className)} {...props}>
      {children}
    </div>
  );
}
