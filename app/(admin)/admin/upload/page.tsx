"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/src/upload/client";
import { ApiError } from "@/src/lib/api-client";

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface QueueItem {
  id: number;
  file: File;
  status: ItemStatus;
  progress: number;
  photoId?: string;
  error?: string;
}

const CONCURRENCY = 2;

const STATUS_TONE: Record<ItemStatus, "neutral" | "blue" | "green" | "red"> = {
  queued: "neutral",
  uploading: "blue",
  done: "green",
  error: "red",
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  done: "Uploaded — processing in background",
  error: "Error",
};

let nextId = 0;

export default function UploadPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track in-flight processing so we don't start the queue twice.
  const runningRef = useRef(false);

  const update = useCallback((id: number, patch: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    );
  }, []);

  const runQueue = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;

    const summary = { done: 0, error: 0 };

    // Drain the queue: repeatedly grab the next "queued" item until none remain.
    const grabNext = (): QueueItem | undefined => {
      let picked: QueueItem | undefined;
      setItems((prev) => {
        const found = prev.find((it) => it.status === "queued");
        if (!found) return prev;
        picked = found;
        return prev.map((it) =>
          it.id === found.id ? { ...it, status: "uploading", progress: 0 } : it,
        );
      });
      return picked;
    };

    const worker = async () => {
      for (;;) {
        const item = grabNext();
        if (!item) return;
        try {
          const { photoId } = await uploadFile(item.file, (frac) =>
            update(item.id, { progress: frac }),
          );
          update(item.id, { status: "done", progress: 1, photoId });
          summary.done += 1;
        } catch (err) {
          update(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
          summary.error += 1;
        }
      }
    };

    await Promise.all(
      Array.from({ length: CONCURRENCY }, () => worker()),
    );

    runningRef.current = false;
    if (summary.done || summary.error) {
      const parts = [`${summary.done} uploaded`];
      if (summary.error) parts.push(`${summary.error} failed`);
      toast(parts.join(", "), summary.error ? "error" : "success");
    }
  }, [toast, update]);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const images = Array.from(fileList).filter((f) =>
        f.type.startsWith("image/"),
      );
      if (images.length === 0) {
        toast("No image files selected", "error");
        return;
      }
      const newItems: QueueItem[] = images.map((file) => ({
        id: nextId++,
        file,
        status: "queued",
        progress: 0,
      }));
      setItems((prev) => [...prev, ...newItems]);
      void runQueue();
    },
    [runQueue, toast],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Upload</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Drag and drop images, or choose files to upload.
          </p>
        </div>
        <Link
          href="/admin/library"
          className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
        >
          View library
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors " +
          (dragging
            ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]"
            : "border-[hsl(var(--border))]")
        }
      >
        <UploadCloud className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm font-medium">Drop images here</p>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          PNG, JPEG, WebP, AVIF
        </p>
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState
              title="No files yet"
              description="Uploaded files will appear here with progress."
            />
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-4 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium">
                        {it.file.name}
                      </span>
                      <Badge tone={STATUS_TONE[it.status]}>
                        {STATUS_LABEL[it.status]}
                      </Badge>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                      <div
                        className={
                          "h-full rounded-full transition-[width] " +
                          (it.status === "error"
                            ? "bg-red-500"
                            : it.status === "done"
                              ? "bg-green-500"
                              : "bg-[hsl(var(--primary))]")
                        }
                        style={{ width: `${it.progress * 100}%` }}
                      />
                    </div>
                    {it.error && (
                      <p className="mt-1 text-xs text-red-600">{it.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
