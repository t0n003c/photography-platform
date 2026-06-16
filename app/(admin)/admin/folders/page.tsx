"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  FolderTree,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  coverPhotoId: string | null;
  sortOrder: number;
  photoCount: number;
}

interface TreeNode extends Folder {
  children: TreeNode[];
  depth: number;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

// Build a nested tree from the flat folder list (roots = parentId null).
function buildTree(folders: Folder[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const f of folders) {
    byId.set(f.id, { ...f, children: [], depth: 0 });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[], depth: number) => {
    nodes.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    for (const n of nodes) {
      n.depth = depth;
      sortRec(n.children, depth + 1);
    }
  };
  sortRec(roots, 0);
  return roots;
}

// ── Name modal (used for create / subfolder / rename) ─────────────────────────

function NameModal({
  title,
  initialName,
  submitLabel,
  onClose,
  onSubmit,
}: {
  title: string;
  initialName?: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === "") return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Folder name" htmlFor="folder-name">
          <Input
            id="folder-name"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weddings"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || name.trim() === ""}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Move modal ────────────────────────────────────────────────────────────────

function MoveModal({
  folder,
  folders,
  onClose,
  onSubmit,
}: {
  folder: Folder;
  folders: Folder[];
  onClose: () => void;
  onSubmit: (parentId: string | null) => Promise<void>;
}) {
  const [parentId, setParentId] = useState<string>(folder.parentId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const options = folders.filter((f) => f.id !== folder.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(parentId === "" ? null : parentId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Move “${folder.name}”`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="New parent folder" htmlFor="move-parent">
          <Select
            id="move-parent"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— (root)</option>
            {options.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Move
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Publish modal ─────────────────────────────────────────────────────────────

function PublishModal({
  folder,
  onClose,
}: {
  folder: Folder;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [as, setAs] = useState<"gallery" | "category">("gallery");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState(folder.name);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; as: string } | null>(
    null,
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{
        as: string;
        id: string;
        slug: string;
        url: string;
      }>(`/api/v1/admin/folders/${folder.id}/publish`, {
        as,
        slug: slug.trim(),
        title: title.trim(),
      });
      setResult({ url: res.url, as: res.as });
      toast("Folder published", "success");
    } catch (err) {
      if (err instanceof ApiError && err.code === "SLUG_TAKEN") {
        setError("That slug is already taken. Choose another.");
      } else if (err instanceof ApiError && err.code === "EMPTY_FOLDER") {
        setError("This folder has no photos to publish.");
      } else {
        setError(errMsg(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Publish “${folder.name}”`}>
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Published as a {result.as}. View it here:
          </p>
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="block break-all text-sm text-[hsl(var(--primary))] underline"
          >
            {result.url}
          </a>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Publish as" htmlFor="publish-as">
            <Select
              id="publish-as"
              value={as}
              onChange={(e) => setAs(e.target.value as "gallery" | "category")}
            >
              <option value="gallery">Gallery</option>
              <option value="category">Category</option>
            </Select>
          </Field>
          <Field label="Slug" htmlFor="publish-slug">
            <Input
              id="publish-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="summer-weddings"
            />
          </Field>
          <Field label="Title" htmlFor="publish-title">
            <Input
              id="publish-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || slug.trim() === "" || title.trim() === ""}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ── Add photos (library picker) modal ─────────────────────────────────────────

function AddPhotosModal({
  existingIds,
  onClose,
  onAdd,
}: {
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
      .get<{ data: PhotoDTO[]; page: number }>(
        `/api/v1/admin/photos?limit=200`,
      )
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

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectedSet = new Set(selected);

  const submit = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      await onAdd(selected);
    } finally {
      setSubmitting(false);
    }
  };

  // Photos already in the folder are still shown but disabled.
  const candidates = library.filter((p) => !existingIds.has(p.id));

  return (
    <Modal
      open
      onClose={onClose}
      title="Add photos"
      className="w-[min(92vw,48rem)]"
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-6 w-6" />
        </div>
      ) : candidates.length === 0 ? (
        <EmptyState
          title="Nothing to add"
          description="Every photo in your library is already in this folder."
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
                        style={{
                          backgroundColor:
                            photo.dominantColor ?? "hsl(var(--muted))",
                        }}
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
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <span className="text-sm text-[hsl(var(--muted-foreground))]">
              {selected.length} selected
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={submitting || selected.length === 0}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Add selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Tree node row ─────────────────────────────────────────────────────────────

function TreeRow({
  node,
  selectedId,
  expanded,
  onToggleExpand,
  onSelect,
  onNewSub,
  onRename,
  onMove,
  onDelete,
}: {
  node: TreeNode;
  selectedId: string | null;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  onNewSub: (node: TreeNode) => void;
  onRename: (node: TreeNode) => void;
  onMove: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        className={
          "group flex items-center gap-1 rounded-md pr-1 " +
          (isSelected ? "bg-[hsl(var(--muted))]" : "hover:bg-[hsl(var(--muted))]")
        }
        style={{ paddingLeft: `${node.depth * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? "Collapse" : "Expand"}
            aria-expanded={isOpen}
            onClick={() => onToggleExpand(node.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node)}
          aria-current={isSelected ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          <FolderTree className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
          <span className="truncate">{node.name}</span>
          <Badge tone="neutral" className="shrink-0">
            {node.photoCount}
          </Badge>
        </button>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={`New subfolder in ${node.name}`}
            title="New subfolder"
            onClick={() => onNewSub(node)}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Rename ${node.name}`}
            title="Rename"
            onClick={() => onRename(node)}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Move ${node.name}`}
            title="Move"
            onClick={() => onMove(node)}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${node.name}`}
            title="Delete"
            onClick={() => onDelete(node)}
            className="flex h-7 w-7 items-center justify-center rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <ul>
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              selectedId={selectedId}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onNewSub={onNewSub}
              onRename={onRename}
              onMove={onMove}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Right pane: selected folder's photos ──────────────────────────────────────

function FolderPhotos({
  folder,
  onCountChanged,
}: {
  folder: Folder;
  onCountChanged: () => void;
}) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: PhotoDTO[] }>(
        `/api/v1/admin/folders/${folder.id}/photos`,
      );
      setPhotos(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  }, [folder.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Persist the current order to the server.
  const persistOrder = useCallback(
    async (ordered: PhotoDTO[]) => {
      setSavingOrder(true);
      try {
        await api.put(`/api/v1/admin/folders/${folder.id}/photos`, {
          items: ordered.map((p, i) => ({ photoId: p.id, sortOrder: i })),
        });
      } catch (err) {
        toast(errMsg(err), "error");
        void load();
      } finally {
        setSavingOrder(false);
      }
    },
    [folder.id, toast, load],
  );

  // Move item from index `from` to index `to`, optimistically, then persist.
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

  const removePhoto = async (id: string) => {
    setBusy(true);
    try {
      await api.del(`/api/v1/admin/folders/${folder.id}/photos`, {
        photoIds: [id],
      });
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      onCountChanged();
      toast("Photo removed", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (photoIds: string[]) => {
    try {
      await api.post(`/api/v1/admin/folders/${folder.id}/photos`, { photoIds });
      setShowAdd(false);
      onCountChanged();
      await load();
      toast(`${photoIds.length} photo(s) added`, "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const existingIds = useMemo(
    () => new Set(photos.map((p) => p.id)),
    [photos],
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate">{folder.name}</CardTitle>
          {savingOrder && (
            <span className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving order
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Add photos
          </Button>
          <Button size="sm" onClick={() => setShowPublish(true)}>
            <Share2 className="h-4 w-4" />
            Publish…
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : photos.length === 0 ? (
          <EmptyState
            title="No photos yet"
            description="Add photos from your library to this folder."
            action={
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" />
                Add photos
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Drag tiles, or use the arrow buttons, to reorder.
            </p>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((photo, index) => {
                const hasVariants = photo.variants.length > 0;
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
                      (dragId === photo.id
                        ? "opacity-50 ring-2 ring-[hsl(var(--ring))]"
                        : "")
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
                        style={{
                          backgroundColor:
                            photo.dominantColor ?? "hsl(var(--muted))",
                        }}
                      >
                        <Badge tone="amber">Processing</Badge>
                      </div>
                    )}
                    <span
                      aria-hidden="true"
                      className="absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/60 px-1 text-[10px] font-semibold text-white"
                    >
                      {index + 1}
                    </span>
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
                        aria-label={`Remove ${photo.altText ?? "photo"} from folder`}
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
          </div>
        )}
      </CardContent>

      {showAdd && (
        <AddPhotosModal
          existingIds={existingIds}
          onClose={() => setShowAdd(false)}
          onAdd={addPhotos}
        />
      )}
      {showPublish && (
        <PublishModal folder={folder} onClose={() => setShowPublish(false)} />
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ModalState =
  | { kind: "new-root" }
  | { kind: "new-sub"; folder: Folder }
  | { kind: "rename"; folder: Folder }
  | { kind: "move"; folder: Folder }
  | null;

export default function FoldersPage() {
  const { toast } = useToast();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ data: Folder[] }>("/api/v1/admin/folders");
      setFolders(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const tree = useMemo(() => buildTree(folders), [folders]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = useMemo(
    () => folders.find((f) => f.id === selectedId) ?? null,
    [folders, selectedId],
  );

  const createFolder = async (name: string, parentId: string | null) => {
    try {
      await api.post(`/api/v1/admin/folders`, { name, parentId });
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      setModal(null);
      await load();
      toast("Folder created", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const renameFolder = async (id: string, name: string) => {
    try {
      await api.patch(`/api/v1/admin/folders/${id}`, { name });
      setModal(null);
      await load();
      toast("Folder renamed", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  const moveFolder = async (id: string, parentId: string | null) => {
    try {
      await api.patch(`/api/v1/admin/folders/${id}`, { parentId });
      setModal(null);
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      await load();
      toast("Folder moved", "success");
    } catch (err) {
      // Server rejects cycles with 422.
      toast(errMsg(err), "error");
    }
  };

  const deleteFolder = async (folder: Folder) => {
    if (
      !window.confirm(
        `Delete “${folder.name}”? This also removes all of its subfolders and their photo memberships. The photos themselves are kept.`,
      )
    ) {
      return;
    }
    try {
      await api.del(`/api/v1/admin/folders/${folder.id}`);
      if (selectedId === folder.id) setSelectedId(null);
      await load();
      toast("Folder deleted", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FolderTree className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Folders</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* LEFT PANE — tree */}
        <Card className="self-start">
          <CardHeader className="flex items-center justify-between gap-2">
            <CardTitle>All folders</CardTitle>
            <Button size="sm" onClick={() => setModal({ kind: "new-root" })}>
              <FolderPlus className="h-4 w-4" />
              New folder
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            ) : tree.length === 0 ? (
              <EmptyState
                title="No folders yet"
                description="Create your first folder to start organizing."
                action={
                  <Button onClick={() => setModal({ kind: "new-root" })}>
                    <FolderPlus className="h-4 w-4" />
                    New folder
                  </Button>
                }
              />
            ) : (
              <ul className="-mx-1">
                {tree.map((node) => (
                  <TreeRow
                    key={node.id}
                    node={node}
                    selectedId={selectedId}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onSelect={(n) => setSelectedId(n.id)}
                    onNewSub={(n) => setModal({ kind: "new-sub", folder: n })}
                    onRename={(n) => setModal({ kind: "rename", folder: n })}
                    onMove={(n) => setModal({ kind: "move", folder: n })}
                    onDelete={(n) => void deleteFolder(n)}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* RIGHT PANE — photos */}
        {selected ? (
          <FolderPhotos
            key={selected.id}
            folder={selected}
            onCountChanged={load}
          />
        ) : (
          <Card className="self-start">
            <CardContent>
              <EmptyState
                title="Select or create a folder"
                description="Pick a folder on the left to view and organize its photos."
              />
            </CardContent>
          </Card>
        )}
      </div>

      {modal?.kind === "new-root" && (
        <NameModal
          title="New folder"
          submitLabel="Create"
          onClose={() => setModal(null)}
          onSubmit={(name) => createFolder(name, null)}
        />
      )}
      {modal?.kind === "new-sub" && (
        <NameModal
          title={`New subfolder in “${modal.folder.name}”`}
          submitLabel="Create"
          onClose={() => setModal(null)}
          onSubmit={(name) => createFolder(name, modal.folder.id)}
        />
      )}
      {modal?.kind === "rename" && (
        <NameModal
          title="Rename folder"
          initialName={modal.folder.name}
          submitLabel="Save"
          onClose={() => setModal(null)}
          onSubmit={(name) => renameFolder(modal.folder.id, name)}
        />
      )}
      {modal?.kind === "move" && (
        <MoveModal
          folder={modal.folder}
          folders={folders}
          onClose={() => setModal(null)}
          onSubmit={(parentId) => moveFolder(modal.folder.id, parentId)}
        />
      )}
    </div>
  );
}
