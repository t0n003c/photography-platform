"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

// Ordered photo manager for a Category or Location. Drag (or arrow) to reorder;
// the first photo is the cover / first shown in indexes, galleries and the
// Scroll Showcase. Add/remove from the library. Self-contained — drop it inside
// a Modal from the Taxonomy page. Backed by GET/PUT/POST/DELETE <base>/photos.
export function MembershipPhotos({
  kind,
  id,
  onCountChanged,
}: {
  kind: "category" | "location";
  id: string;
  onCountChanged?: (count: number) => void;
}) {
  const { toast } = useToast();
  const base = `/api/v1/admin/${kind === "category" ? "categories" : "locations"}/${id}`;
  const noun = kind === "category" ? "category" : "location";

  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PhotoDTO[] }>(`${base}/photos`);
      setPhotos(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  }, [base, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const persistOrder = useCallback(
    async (ordered: PhotoDTO[]) => {
      setSavingOrder(true);
      try {
        await api.put(`${base}/photos`, {
          items: ordered.map((p, i) => ({ photoId: p.id, sortOrder: i })),
        });
      } catch (err) {
        toast(errMsg(err), "error");
        void load();
      } finally {
        setSavingOrder(false);
      }
    },
    [base, toast, load],
  );

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setPhotos((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      void persistOrder(next);
      return next;
    });
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = photos.findIndex((p) => p.id === dragId);
    const to = photos.findIndex((p) => p.id === targetId);
    moveItem(from, to);
    setDragId(null);
  };

  const removePhoto = async (pid: string) => {
    setBusy(true);
    try {
      await api.del(`${base}/photos`, { photoIds: [pid] });
      const next = photos.filter((p) => p.id !== pid);
      setPhotos(next);
      onCountChanged?.(next.length);
      toast("Photo removed", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (photoIds: string[]) => {
    try {
      await api.post(`${base}/photos`, { photoIds });
      setShowAdd(false);
      const res = await api.get<{ data: PhotoDTO[] }>(`${base}/photos`);
      setPhotos(res.data);
      onCountChanged?.(res.data.length);
      toast(`${photoIds.length} photo(s) added`, "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const existingIds = useMemo(() => new Set(photos.map((p) => p.id)), [photos]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Drag tiles, or use the arrows, to reorder. The first photo is the{" "}
          <span className="font-medium text-[hsl(var(--foreground))]">cover</span> and the
          first shown in galleries, the {noun} page, and the Scroll Showcase.
        </p>
        <div className="flex items-center gap-2">
          {savingOrder && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving order
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add photos
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description={`Add photos from your library to this ${noun}.`}
          action={
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Add photos
            </Button>
          }
        />
      ) : (
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => {
            const hasVariants = photo.variants.length > 0;
            const isCover = index === 0;
            return (
              <li
                key={photo.id}
                draggable
                onDragStart={() => setDragId(photo.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(photo.id);
                }}
                onDragEnd={() => setDragId(null)}
                className={
                  "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] " +
                  (dragId === photo.id ? "opacity-50 ring-2 ring-[hsl(var(--ring))] " : "") +
                  (isCover ? "ring-2 ring-[hsl(var(--primary))]" : "")
                }
              >
                {hasVariants ? (
                  <ResponsiveImage
                    photo={photo}
                    sizes="(max-width:768px) 50vw, 200px"
                    className="h-full w-full"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ backgroundColor: photo.dominantColor ?? "hsl(var(--muted))" }}
                  >
                    <Badge tone="amber">Processing</Badge>
                  </div>
                )}
                {isCover ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary-foreground))]">
                    Cover
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1 text-[10px] font-semibold text-white"
                  >
                    {index + 1}
                  </span>
                )}
                <GripVertical
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-4 w-4 text-white/80 drop-shadow"
                />
                <div className="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`Move ${photo.altText ?? "photo"} earlier`}
                    disabled={index === 0 || busy}
                    onClick={() => moveItem(index, index - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${photo.altText ?? "photo"} later`}
                    disabled={index === photos.length - 1 || busy}
                    onClick={() => moveItem(index, index + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${photo.altText ?? "photo"} from ${noun}`}
                    disabled={busy}
                    onClick={() => removePhoto(photo.id)}
                    className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-red-600 disabled:opacity-30"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {showAdd && (
        <AddPhotosModal
          noun={noun}
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onAdd={addPhotos}
        />
      )}
    </div>
  );
}

function AddPhotosModal({
  noun,
  existingIds,
  onClose,
  onAdd,
}: {
  noun: string;
  existingIds: Set<string>;
  onClose: () => void;
  onAdd: (photoIds: string[]) => Promise<void>;
}) {
  const { toast } = useToast();
  const [library, setLibrary] = useState<PhotoDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data: PhotoDTO[] }>(`/api/v1/admin/photos?limit=200`)
      .then((res) => {
        if (active) setLibrary(res.data);
      })
      .catch((err) => {
        if (active) toast(errMsg(err), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const selectedSet = new Set(selected);
  const candidates = library.filter((p) => !existingIds.has(p.id));

  const submit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await onAdd(selected);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add photos" className="w-[min(92vw,48rem)]">
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Nothing to add"
          description={`Every photo in your library is already in this ${noun}.`}
        />
      ) : (
        <div className="space-y-4">
          <div className="max-h-[55vh] overflow-y-auto">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {candidates.map((photo) => {
                const isSel = selectedSet.has(photo.id);
                const hasVariants = photo.variants.length > 0;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => toggle(photo.id)}
                    aria-pressed={isSel}
                    aria-label={photo.altText ?? "Photo"}
                    className={
                      "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] text-left " +
                      (isSel ? "ring-2 ring-[hsl(var(--ring))]" : "")
                    }
                  >
                    {hasVariants ? (
                      <ResponsiveImage
                        photo={photo}
                        sizes="(max-width:768px) 33vw, 150px"
                        className="h-full w-full"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center"
                        style={{ backgroundColor: photo.dominantColor ?? "hsl(var(--muted))" }}
                      >
                        <Badge tone="amber">Processing</Badge>
                      </div>
                    )}
                    <span
                      aria-hidden="true"
                      className={
                        "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border " +
                        (isSel
                          ? "border-[hsl(var(--ring))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                          : "border-white/80 bg-black/30 text-transparent")
                      }
                    >
                      <Check className="h-3 w-3" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {selected.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={selected.length === 0 || submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add {selected.length > 0 ? selected.length : ""}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
