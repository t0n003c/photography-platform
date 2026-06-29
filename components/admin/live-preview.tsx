"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PreviewGrid =
  | "masonry"
  | "justified"
  | "uniform"
  | "horizontal-lenis"
  | "parallax-ring"
  | "image-trail"
  | "rotating-scroll"
  | "carousel-3d-scroll"
  | "alternative-scroll";
export type PreviewSpacing = "tight" | "normal" | "airy";
export type PreviewTheme = "light" | "dark" | "auto";

export type PreviewOverlay = "minimal" | "editorial" | "centered";
export type PreviewImageTrailVariant =
  | "fade-shrink"
  | "zoom-fade"
  | "drop"
  | "scatter"
  | "stretch-drop"
  | "full-frame";
export type PreviewRotatingScrollVariant =
  | "demo1"
  | "demo2"
  | "demo3"
  | "demo4"
  | "demo5";

export interface PreviewDraft {
  gridType: PreviewGrid;
  spacing: PreviewSpacing;
  theme: PreviewTheme;
  hero?: Record<string, unknown>;
  overlay?: PreviewOverlay;
  altUseBackground?: boolean;
  altBackgroundColor?: string;
  altTextColor?: string;
  altShowText?: boolean;
  imgTrailVariant?: PreviewImageTrailVariant;
  imgTrailUseBackground?: boolean;
  imgTrailBackgroundColor?: string;
  rotatingScrollVariant?: PreviewRotatingScrollVariant;
  rotatingScrollUseBackground?: boolean;
  rotatingScrollBackgroundColor?: string;
  rotatingScrollMarqueeText?: string;
}

type PreviewDevice = "desktop" | "mobile";

function preferredPreviewDevice(): PreviewDevice {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

// Browser-safe encoder matching src/lib/preview.ts decodePreview (base64url of
// the UTF-8 JSON). The public/preview page reads `__pc` and applies it ONLY for
// an authenticated admin, so visitors never see unsaved drafts.
export function encodePreviewClient(cfg: PreviewDraft): string {
  const json = JSON.stringify(cfg);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Iframe preview of a public surface with the unsaved draft applied via `__pc`.
// Reused by the Design tab (per-scope) and the Galleries editor (per-gallery).
export function LivePreview({
  baseUrl,
  draft,
  height = 640,
}: {
  baseUrl: string;
  draft: PreviewDraft;
  height?: number;
}) {
  const [device, setDevice] = useState<PreviewDevice>(preferredPreviewDevice);
  const [manualDevice, setManualDevice] = useState(false);
  const [nudge, setNudge] = useState(0);
  const frameHeight = device === "mobile" ? Math.max(height, 844) : height;

  useEffect(() => {
    if (manualDevice) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setDevice(mq.matches ? "mobile" : "desktop");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [manualDevice]);

  // Debounce so we don't reload the iframe on every keystroke.
  const [debounced, setDebounced] = useState(draft);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(t);
  }, [draft]);

  const { src, openSrc } = useMemo(() => {
    const params = new URLSearchParams();
    params.set("__pc", encodePreviewClient(debounced));
    if (debounced.theme === "light" || debounced.theme === "dark") {
      params.set("__theme", debounced.theme);
    }
    if (nudge) params.set("__r", String(nudge));
    const openParams = new URLSearchParams(params);
    params.set("__previewFrame", "1");
    return {
      src: `${baseUrl}?${params.toString()}`,
      openSrc: `${baseUrl}?${openParams.toString()}`,
    };
  }, [baseUrl, debounced, nudge]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
          Live preview
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={device === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setManualDevice(true);
              setDevice("desktop");
            }}
            aria-label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setManualDevice(true);
              setDevice("mobile");
            }}
            aria-label="Mobile preview"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNudge((n) => n + 1)}
            aria-label="Reload preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a
            href={openSrc}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center rounded-md border px-2 text-xs"
          >
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
        <div
          className="mx-auto bg-[hsl(var(--background))] transition-[max-width] duration-200"
          style={{ maxWidth: device === "mobile" ? 390 : "100%" }}
        >
          <iframe
            key={device}
            src={src}
            title="Preview"
            className="w-full border-0"
            style={{ height: frameHeight }}
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
