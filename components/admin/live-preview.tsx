"use client";

import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PreviewGrid = "masonry" | "justified" | "uniform";
export type PreviewSpacing = "tight" | "normal" | "airy";
export type PreviewTheme = "light" | "dark" | "auto";

export interface PreviewDraft {
  gridType: PreviewGrid;
  spacing: PreviewSpacing;
  theme: PreviewTheme;
  hero?: Record<string, unknown>;
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [nudge, setNudge] = useState(0);

  // Debounce so we don't reload the iframe on every keystroke.
  const [debounced, setDebounced] = useState(draft);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(t);
  }, [draft]);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    params.set("__pc", encodePreviewClient(debounced));
    if (debounced.theme === "light" || debounced.theme === "dark") {
      params.set("__theme", debounced.theme);
    }
    if (nudge) params.set("__r", String(nudge));
    return `${baseUrl}?${params.toString()}`;
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
            onClick={() => setDevice("desktop")}
            aria-label="Desktop preview"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "default" : "outline"}
            size="sm"
            onClick={() => setDevice("mobile")}
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
            href={src}
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
            style={{ height }}
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
