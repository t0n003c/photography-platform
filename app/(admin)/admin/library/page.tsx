"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderTree, Images, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";
import {
  FolderDropPanel,
  FoldersManager,
} from "@/components/admin/folders-manager";

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
  multiSelect,
  onOpen,
  onSelect,
  onLongPress,
  onDragStart,
}: {
  photo: PhotoDTO;
  selected: boolean;
  multiSelect: boolean;
  onOpen: () => void;
  onSelect: (shiftKey: boolean) => void;
  onLongPress: () => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const hasVariants = photo.variants.length > 0;
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        longPressed.current = false;
        clearLongPress();
        longPressTimer.current = window.setTimeout(() => {
          longPressed.current = true;
          onLongPress();
        }, 450);
      }}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      className={
        "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] " +
        (selected ? "ring-2 ring-[hsl(var(--ring))]" : "")
      }
    >
      <button
        type="button"
        onClick={(e) => {
          if (longPressed.current) {
            longPressed.current = false;
            return;
          }
          if (multiSelect) onSelect(e.shiftKey);
          else onOpen();
        }}
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
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        aria-label="Photo details"
        className="absolute right-2 top-2 h-7 w-7 bg-[hsl(var(--background))]/90 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Info className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function DetailSidePanel({
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
  const [headline, setHeadline] = useState("");
  const [subhead, setSubhead] = useState("");
  const [caption, setCaption] = useState("");
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
        setHeadline(res.photo.headline ?? "");
        setSubhead(res.photo.subhead ?? "");
        setCaption(res.photo.caption ?? "");
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
      const t = (v: string) => (v.trim() === "" ? null : v.trim());
      const res = await api.patch<{ photo: PhotoDTO }>(
        `/api/v1/admin/photos/${photoId}`,
        {
          altText: t(altText),
          headline: t(headline),
          subhead: t(subhead),
          caption: t(caption),
        },
      );
      setPhoto((prev) => (prev ? { ...prev, ...res.photo } : res.photo));
      onChanged(res.photo);
      toast("Saved", "success");
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
    <aside
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-[hsl(var(--background))] shadow-xl sm:w-[28rem]"
      aria-label="Photo details"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">Photo details</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      {loading || !photo ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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

          <p className="pt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Editorial copy below shows in immersive layouts (e.g. a gallery&rsquo;s
            Horizontal Scroll detail view).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Headline" htmlFor="ph-headline">
              <Input
                id="ph-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="A short title"
              />
            </Field>
            <Field label="Subhead" htmlFor="ph-subhead">
              <Input
                id="ph-subhead"
                value={subhead}
                onChange={(e) => setSubhead(e.target.value)}
                placeholder="A secondary line"
              />
            </Field>
          </div>
          <Field label="Caption" htmlFor="ph-caption">
            <Textarea
              id="ph-caption"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="A longer description shown alongside the photo"
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
    </aside>
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
  const [view, setView] = useState<"photos" | "folders">("photos");
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [multiSelect, setMultiSelect] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [assignKind, setAssignKind] = useState<AssignKind>(null);
  const [assignMode, setAssignMode] = useState<"add" | "remove">("add");
  const [acting, setActing] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);

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
    setLastSelectedId(id);
  }, []);

  const selectAll = () => {
    setMultiSelect(true);
    setSelected(new Set(photos.map((p) => p.id)));
    setLastSelectedId(photos.at(-1)?.id ?? null);
  };
  const clearSelection = () => {
    setSelected(new Set());
    setLastSelectedId(null);
    setMultiSelect(false);
  };

  const selectedIds = Array.from(selected);
  const photoDragIds = (photoId: string) =>
    selected.has(photoId) ? selectedIds : [photoId];
  const selectRange = (toId: string) => {
    if (!lastSelectedId) {
      toggle(toId);
      return;
    }
    const from = photos.findIndex((p) => p.id === lastSelectedId);
    const to = photos.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) {
      toggle(toId);
      return;
    }
    const [start, end] = from < to ? [from, to] : [to, from];
    const ids = photos.slice(start, end + 1).map((p) => p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    setLastSelectedId(toId);
  };
  const selectPhoto = (photoId: string, shiftKey: boolean) => {
    setMultiSelect(true);
    if (shiftKey) selectRange(photoId);
    else toggle(photoId);
  };
  const openPhoto = (photoId: string) => {
    setDetailId(photoId);
    setMultiSelect(false);
  };
  const enterMultiSelect = (photoId: string) => {
    setMultiSelect(true);
    setSelected((prev) => {
      const next = new Set(prev);
      next.add(photoId);
      return next;
    });
    setLastSelectedId(photoId);
  };

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
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold">Library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Manage photos and organize them into private folders.
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-[hsl(var(--background))] p-1">
          <button
            type="button"
            onClick={() => setView("photos")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
              view === "photos"
                ? "bg-[hsl(var(--muted))] font-medium"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <Images className="h-4 w-4" />
            Photos
          </button>
          <button
            type="button"
            onClick={() => setView("folders")}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
              view === "folders"
                ? "bg-[hsl(var(--muted))] font-medium"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            <FolderTree className="h-4 w-4" />
            Folders
          </button>
        </div>
      </div>

      {view === "folders" ? (
        <FoldersManager embedded />
      ) : (
        <div
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes("application/x-photo-ids") &&
              e.clientX > window.innerWidth - 72
            ) {
              setFoldersOpen(true);
            }
          }}
        >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media library</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {photos.length} photo{photos.length === 1 ? "" : "s"} loaded
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
          <span className="ml-auto text-sm text-[hsl(var(--muted-foreground))] sm:ml-0">
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
          <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-5">
              {photos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  selected={selected.has(photo.id)}
                  multiSelect={multiSelect}
                  onOpen={() => openPhoto(photo.id)}
                  onSelect={(shiftKey) => selectPhoto(photo.id, shiftKey)}
                  onLongPress={() => enterMultiSelect(photo.id)}
                  onDragStart={(e) => {
                    const ids = photoDragIds(photo.id);
                    e.dataTransfer.setData(
                      "application/x-photo-ids",
                      JSON.stringify(ids),
                    );
                    e.dataTransfer.effectAllowed = "copy";
                    setFoldersOpen(true);
                  }}
                />
              ))}
            </div>
            <FolderDropPanel
              mobileOpen={foldersOpen}
              onMobileOpenChange={setFoldersOpen}
            />
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
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">
              {selected.size} selected
            </span>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
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
        <DetailSidePanel
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
      )}
    </div>
  );
}
