"use client";

import { useEffect, useState } from "react";

// Capability + preference gates for the WebGL enhancement layer (PERFORMANCE.md
// §4). The static site must be fully usable without any of this.

export function hasWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return (
      !!window.WebGLRenderingContext &&
      !!(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function prefersReducedData(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  return !!conn?.saveData;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/**
 * Returns true ONLY when WebGL should enhance: client-side, WebGL supported,
 * motion + data preferences allow it, AND the browser is idle (so it never
 * competes with hydration or the LCP image).
 */
export function useWebGLEnhancement(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion() || prefersReducedData() || !hasWebGL()) return;
    let cancelled = false;
    const w = window as IdleWindow;
    const schedule =
      w.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 500));
    schedule(() => {
      if (!cancelled) setEnabled(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}
