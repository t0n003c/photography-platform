"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Film, Download } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

type VideoStatus = "none" | "pending" | "rendering" | "ready" | "failed";
interface VideoState {
  status: VideoStatus;
  enabled: boolean;
  generatedAt: string | null;
  url: string | null;
}

const TONE: Record<VideoStatus, "neutral" | "amber" | "green" | "red"> = {
  none: "neutral",
  pending: "amber",
  rendering: "amber",
  ready: "green",
  failed: "red",
};

// Admin card: generate (and download) a Remotion slideshow video for a gallery.
export function GalleryVideoCard({ galleryId }: { galleryId: string }) {
  const { toast } = useToast();
  const [state, setState] = useState<VideoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ video: VideoState }>(
        `/api/v1/admin/galleries/${galleryId}/video`,
      );
      setState(res.video);
      return res.video.status;
    } catch {
      return undefined;
    }
  }, [galleryId]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  // Poll while a render is in progress.
  useEffect(() => {
    const s = state?.status;
    if (s === "pending" || s === "rendering") {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => void load(), 3000);
      }
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [state?.status, load]);

  async function generate() {
    setBusy(true);
    try {
      await api.post(`/api/v1/admin/galleries/${galleryId}/video`);
      toast("Slideshow render started.", "success");
      await load();
    } catch (err) {
      toast(
        err instanceof ApiError ? err.message : "Could not start render.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const status = state?.status ?? "none";
  const rendering = status === "pending" || status === "rendering";

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
            aria-hidden="true"
          />
          <CardTitle className="flex items-center gap-2">
            <Film className="h-4 w-4" /> Slideshow video
          </CardTitle>
        </button>
        {state && status !== "none" && (
          <Badge tone={TONE[status]} className="capitalize">
            {status}
          </Badge>
        )}
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {state && !state.enabled ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Slideshow video rendering isn&apos;t enabled on this server. Enable
              it in deployment config (see docs/AI-INTEGRATIONS.md).
            </p>
          ) : (
            <>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Render an MP4 slideshow of this gallery&apos;s photos with Remotion.
              </p>
              <div className="flex items-center gap-3">
                <Button onClick={generate} disabled={busy || rendering}>
                  {rendering ? <Spinner /> : <Film className="h-4 w-4" />}
                  {status === "ready" ? "Re-render" : "Generate video"}
                </Button>
                {status === "ready" && state?.url && (
                  <a href={state.url} className="inline-flex">
                    <Button variant="outline">
                      <Download className="h-4 w-4" /> Download
                    </Button>
                  </a>
                )}
              </div>
              {status === "failed" && (
                <p className="text-sm text-red-600">
                  Last render failed. Check the worker logs and try again.
                </p>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
