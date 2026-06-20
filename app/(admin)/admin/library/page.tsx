"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
}

interface PhotoDetail extends PhotoDTO {
  filename?: string;
  mimeType?: string;
  byteSize?: number;
  processingStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  memberships?: {
    galleries: string[];
    categories: string[];
    locations: string[];
  };
}

interface NamedEntity {
  id: string;
  name: string;
}

type AssignKind = "category" | "location" | null;

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i += 1;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function PhotoTile({
  photo,
  selected,
  onToggle,
  onInfo,
}: {
  photo: PhotoDTO;
  selected: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  const hasVariants = photo.variants.length > 0;
  return (
    <div
      className={
        "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] " +
        (selected ? "ring-2 ring-[hsl(var(--ring))]" : "")
      }
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="block h-full w-full text-left"
      >
        {hasVariants ? (
          <ResponsiveImage
            photo={photo}
            sizes="(max-width:768px) 50vw, 220px"
            className="h-full w-full"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundColor: photo.dominantColor ?? "hsl(var(--muted))",
            }}
          >
            <Badge tone="amber">Processing</Badge>
          </div>
        )}
      </button>

      <span
        aria-hidden="true"
        className={
          "pointer-events-none absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] " +
          (selected
            ? "border-[hsl(var(--ring))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "border-white/80 bg-black/30 text-transparent")
        }
      >
        ✓
      </span>

      <Button
        size="icon"
        variant="outline"
        onClick={onInfo}
        aria-label="Photo details"
        className="absolute right-2 top-2 h-7 w-7 bg-[hsl(var(--background))]/90 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function DetailModal({
  photoId,
  onClose,
  onChanged,
  onDeleted,
}: {
  photoId: string;
  onClose: () => void;
  onChanged: (photo: PhotoDTO) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [photo, setPhoto] = useState<PhotoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [altText, setAltText] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ photo: PhotoDetail }>(`/api/v1/admin/photos/${photoId}`)
      .then((res) => {
        if (!active) return;
        setPhoto(res.photo);
        setAltText(res.photo.altText ?? "");
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
  }, [photoId, toast]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ photo: PhotoDTO }>(
        `/api/v1/admin/photos/${photoId}`,
        { altText: altText.trim() === "" ? null : altText },
      );
      setPhoto((prev) => (prev ? { ...prev, ...res.photo } : res.photo));
      onChanged(res.photo);
      toast("Alt text saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const reprocess = async () => {
    setBusy(true);
    try {
      await api.post(`/api/v1/admin/photos/${photoId}/reprocess`);
      toast("Reprocessing started", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this photo? This cannot be undone.")) return;
    setBusy(true);
    try {
      await api.del(`/api/v1/admin/photos/${photoId}`);
      toast("Photo deleted", "success");
      onDeleted(photoId);
      onClose();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Photo details">
      {loading || !photo ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
            {photo.variants.length > 0 ? (
              <ResponsiveImage
                photo={photo}
                sizes="(max-width:768px) 92vw, 28rem"
                className="h-auto w-full"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center">
                <Badge tone="amber">Processing</Badge>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[hsl(var(--muted-foreground))]">
            {photo.filename && (
              <div className="col-span-2">
                <dt className="inline font-medium text-[hsl(var(--foreground))]">
                  File:{" "}
                </dt>
                <dd className="inline break-all">{photo.filename}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium text-[hsl(var(--foreground))]">
                Dimensions:{" "}
              </dt>
              <dd className="inline">
                {photo.width}×{photo.height}
              </dd>
            </div>
            {typeof photo.byteSize === "number" && (
              <div>
                <dt className="inline font-medium text-[hsl(var(--foreground))]">
                  Size:{" "}
                </dt>
                <dd className="inline">{formatBytes(photo.byteSize)}</dd>
              </div>
            )}
            {photo.capturedAt && (
              <div className="col-span-2">
                <dt className="inline font-medium text-[hsl(var(--foreground))]">
                  Captured:{" "}
                </dt>
                <dd className="inline">
                  {new Date(photo.capturedAt).toLocaleString()}
                </dd>
              </div>
            )}
            {photo.processingStatus && (
              <div>
                <dt className="inline font-medium text-[hsl(var(--foreground))]">
                  Status:{" "}
                </dt>
                <dd className="inline">{photo.processingStatus}</dd>
              </div>
            )}
            <div>
              <dt className="inline font-medium text-[hsl(var(--foreground))]">
                Variants:{" "}
              </dt>
              <dd className="inline">{photo.variants.length}</dd>
            </div>
          </dl>

          <Field label="Alt text" htmlFor="alt-text">
            <Input
              id="alt-text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe this image"
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reprocess} disabled={busy}>
                Reprocess
              </Button>
              <Button variant="destructive" onClick={remove} disabled={busy}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function AssignModal({
  kind,
  mode,
  count,
  onClose,
  onAssign,
}: {
  kind: Exclude<AssignKind, null>;
  mode: "add" | "remove";
  count: number;
  onClose: () => void;
  onAssign: (id: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [entities, setEntities] = useState<NamedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const path = kind === "category" ? "categories" : "locations";
  const noun = kind === "category" ? "category" : "location";
  const isRemove = mode === "remove";

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data: NamedEntity[] }>(`/api/v1/admin/${path}`)
      .then((res) => {
        if (!active) return;
        setEntities(res.data);
        if (res.data.length > 0) setChosen(res.data[0].id);
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
  }, [path, toast]);

  const submit = async () => {
    if (!chosen) return;
    setSubmitting(true);
    try {
      await onAssign(chosen);
      onClose();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${isRemove ? "Remove from" : "Add to"} ${noun}`}>
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      ) : entities.length === 0 ? (
        <EmptyState
          title={`No ${noun} options`}
          description={`Create a ${noun} first.`}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {isRemove ? "Remove" : "Add"} {count} photo{count === 1 ? "" : "s"}{" "}
            {isRemove ? "from" : "to"} a {noun}.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="assign-select">{noun}</Label>
            <Select
              id="assign-select"
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting}
              variant={isRemove ? "destructive" : "default"}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRemove ? "Remove" : "Add"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function LibraryPage() {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignKind, setAssignKind] = useState<AssignKind>(null);
  const [assignMode, setAssignMode] = useState<"add" | "remove">("add");
  const [acting, setActing] = useState(false);

  const load = useCallback(
    async (cursor: string | null) => {
      const isInitial = cursor === null;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);
      try {
        const qs = cursor
          ? `?limit=48&cursor=${encodeURIComponent(cursor)}`
          : "?limit=48";
        const res = await api.get<{ data: PhotoDTO[]; page: PageMeta }>(
          `/api/v1/admin/photos${qs}`,
        );
        setPhotos((prev) => (isInitial ? res.data : [...prev, ...res.data]));
        setNextCursor(res.page.nextCursor);
      } catch (err) {
        toast(errMsg(err), "error");
      } finally {
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => setSelected(new Set(photos.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());

  const selectedIds = Array.from(selected);

  const assign = async (targetId: string) => {
    const path = assignKind === "category" ? "categories" : "locations";
    const url = `/api/v1/admin/${path}/${targetId}/photos`;
    const n = selectedIds.length;
    if (assignMode === "remove") {
      await api.del(url, { photoIds: selectedIds });
      toast(`Removed ${n} photo${n === 1 ? "" : "s"}`, "success");
    } else {
      await api.post(url, { photoIds: selectedIds });
      toast(`Added ${n} photo${n === 1 ? "" : "s"}`, "success");
    }
    clearSelection();
  };

  const reprocessSelected = async () => {
    setActing(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          api.post(`/api/v1/admin/photos/${id}/reprocess`),
        ),
      );
      toast(`Reprocessing ${selectedIds.length} photos`, "success");
      clearSelection();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setActing(false);
    }
  };

  const deleteSelected = async () => {
    if (
      !window.confirm(
        `Delete ${selectedIds.length} photo${
          selectedIds.length === 1 ? "" : "s"
        }? This cannot be undone.`,
      )
    )
      return;
    setActing(true);
    try {
      await Promise.all(
        selectedIds.map((id) => api.del(`/api/v1/admin/photos/${id}`)),
      );
      const removed = new Set(selectedIds);
      setPhotos((prev) => prev.filter((p) => !removed.has(p.id)));
      clearSelection();
      toast("Photos deleted", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setActing(false);
    }
  };

  const handleDetailChanged = useCallback((updated: PhotoDTO) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
    );
  }, []);

  const handleDetailDeleted = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {photos.length} photo{photos.length === 1 ? "" : "s"} loaded
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            disabled={selected.size === 0}
          >
            Clear
          </Button>
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {selected.size} selected
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description="Upload images to get started."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                selected={selected.has(photo.id)}
                onToggle={() => toggle(photo.id)}
                onInfo={() => setDetailId(photo.id)}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => load(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-[hsl(var(--background))]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAssignMode("add"); setAssignKind("category"); }}
                disabled={acting}
              >
                Add to category…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAssignMode("add"); setAssignKind("location"); }}
                disabled={acting}
              >
                Add to location…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAssignMode("remove"); setAssignKind("category"); }}
                disabled={acting}
              >
                Remove from category…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAssignMode("remove"); setAssignKind("location"); }}
                disabled={acting}
              >
                Remove from location…
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={reprocessSelected}
                disabled={acting}
              >
                Reprocess
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={acting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {detailId && (
        <DetailModal
          photoId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={handleDetailChanged}
          onDeleted={handleDetailDeleted}
        />
      )}

      {assignKind && (
        <AssignModal
          kind={assignKind}
          mode={assignMode}
          count={selected.size}
          onClose={() => setAssignKind(null)}
          onAssign={assign}
        />
      )}
    </div>
  );
}
