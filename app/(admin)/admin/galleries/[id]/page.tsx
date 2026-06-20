"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  Copy,
  Download,
  Eye,
  GripVertical,
  Heart,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GalleryVideoCard } from "@/components/admin/gallery-video-card";
import {
  LivePreview,
  type PreviewGrid,
  type PreviewSpacing,
  type PreviewTheme,
} from "@/components/admin/live-preview";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useStepUp } from "@/components/admin/step-up";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

type Visibility = "public" | "private";
type Status = "draft" | "published" | "archived";

interface Gallery {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  status: Status;
  downloadEnabled: boolean;
  expiresAt: string | null;
  pageConfigId: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
}

interface Grant {
  id: string;
  label: string | null;
  clientId: string | null;
  canView: boolean;
  canFavorite: boolean;
  canDownload: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

/** Convert an ISO string to a value usable by <input type="datetime-local">. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local value back to an ISO string (or null if empty). */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ── Settings card ────────────────────────────────────────────────────────────

function SettingsCard({
  gallery,
  onSaved,
}: {
  gallery: Gallery;
  onSaved: (g: Gallery) => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(gallery.title);
  const [description, setDescription] = useState(gallery.description ?? "");
  const [visibility, setVisibility] = useState<Visibility>(gallery.visibility);
  const [status, setStatus] = useState<Status>(gallery.status);
  const [downloadEnabled, setDownloadEnabled] = useState(
    gallery.downloadEnabled,
  );
  const [expiresAt, setExpiresAt] = useState(isoToLocalInput(gallery.expiresAt));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ data?: Gallery } | Gallery>(
        `/api/v1/admin/galleries/${gallery.id}`,
        {
          title,
          description: description.trim() === "" ? null : description,
          visibility,
          status,
          downloadEnabled,
          expiresAt: localInputToIso(expiresAt),
        },
      );
      const updated =
        res && typeof res === "object" && "data" in res && res.data
          ? res.data
          : (res as Gallery);
      onSaved(updated);
      toast("Settings saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const showPublicLink =
    status === "published" && visibility === "public" && gallery.slug;

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Settings</CardTitle>
        {showPublicLink && (
          <Link
            href={`/galleries/${gallery.slug}`}
            target="_blank"
            className="text-sm text-[hsl(var(--primary))] underline"
          >
            View public page
          </Link>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Title" htmlFor="g-title">
          <Input
            id="g-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Description" htmlFor="g-desc">
          <Textarea
            id="g-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility" htmlFor="g-visibility">
            <Select
              id="g-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="g-status">
            <Select
              id="g-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
        </div>
        <Field label="Expires at" htmlFor="g-expires">
          <Input
            id="g-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Input
            type="checkbox"
            className="h-4 w-4"
            checked={downloadEnabled}
            onChange={(e) => setDownloadEnabled(e.target.checked)}
          />
          Allow downloads
        </label>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Photos card ──────────────────────────────────────────────────────────────

function PhotosCard({ galleryId }: { galleryId: string }) {
  const { toast } = useToast();
  const [library, setLibrary] = useState<PhotoDTO[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<{ data: PhotoDTO[] }>(
        `/api/v1/admin/galleries/${galleryId}/photos`,
      ),
      api.get<{ data: PhotoDTO[] }>(`/api/v1/admin/photos?limit=200`),
    ])
      .then(([membership, lib]) => {
        if (!active) return;
        setLibrary(lib.data);
        setSelected(membership.data.map((p) => p.id));
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
  }, [galleryId, toast]);

  const selectedSet = new Set(selected);
  const photoById = new Map(library.map((p) => [p.id, p]));

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Move the item at `from` so it sits at index `to` (used by both drag-drop
  // and the keyboard up/down fallback).
  const moveItem = (from: number, to: number) => {
    setSelected((prev) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= prev.length ||
        to >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = selected.indexOf(dragId);
    const to = selected.indexOf(targetId);
    moveItem(from, to);
    setDragId(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/admin/galleries/${galleryId}/photos`, {
        items: selected.map((photoId, i) => ({ photoId, sortOrder: i })),
      });
      toast("Photos saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Photos</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {selected.length} selected
          </span>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save photos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : library.length === 0 ? (
          <EmptyState
            title="No photos in library"
            description="Upload photos before adding them to a gallery."
          />
        ) : (
          <div className="space-y-6">
            {selected.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Order</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Drag tiles, or use the arrow buttons, to reorder.
                  </p>
                </div>
                <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {selected.map((id, index) => {
                    const photo = photoById.get(id);
                    const hasVariants =
                      !!photo && photo.variants.length > 0;
                    return (
                      <li
                        key={id}
                        draggable
                        onDragStart={() => setDragId(id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleDrop(id);
                        }}
                        onDragEnd={() => setDragId(null)}
                        className={
                          "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] " +
                          (dragId === id ? "opacity-50 ring-2 ring-[hsl(var(--ring))]" : "")
                        }
                      >
                        {photo && hasVariants ? (
                          <ResponsiveImage
                            photo={photo}
                            sizes="(max-width:768px) 33vw, 160px"
                            className="h-full w-full"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{
                              backgroundColor:
                                photo?.dominantColor ?? "hsl(var(--muted))",
                            }}
                          >
                            <Badge tone="amber">
                              {photo ? "Processing" : "Missing"}
                            </Badge>
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
                            aria-label="Move earlier"
                            disabled={index === 0}
                            onClick={() => moveItem(index, index - 1)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move later"
                            disabled={index === selected.length - 1}
                            onClick={() => moveItem(index, index + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80 disabled:opacity-30"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Remove from gallery"
                            onClick={() => toggle(id)}
                            className="flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-red-600"
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

            <div className="space-y-2">
              <p className="text-sm font-medium">Library</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {library.map((photo) => {
                  const isSel = selectedSet.has(photo.id);
              const hasVariants = photo.variants.length > 0;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => toggle(photo.id)}
                  aria-pressed={isSel}
                  className={
                    "group relative aspect-square overflow-hidden rounded-lg border bg-[hsl(var(--muted))] text-left " +
                    (isSel ? "ring-2 ring-[hsl(var(--ring))]" : "")
                  }
                >
                  {hasVariants ? (
                    <ResponsiveImage
                      photo={photo}
                      sizes="(max-width:768px) 33vw, 160px"
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Share link (grants) card ─────────────────────────────────────────────────

function ShareUrlBox({ url }: { url: string }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast("Copied to clipboard", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={copy}>
        <Copy className="h-4 w-4" />
        Copy
      </Button>
    </div>
  );
}

function CreateGrantModal({
  galleryId,
  onClose,
  onCreated,
}: {
  galleryId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [label, setLabel] = useState("");
  const [view, setView] = useState(true);
  const [favorite, setFavorite] = useState(true);
  const [download, setDownload] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: ClientOption[] }>("/api/v1/admin/clients")
      .then((res) => {
        if (active) setClients(res.data);
      })
      .catch(() => {
        /* clients optional; ignore failure */
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<{ grant: Grant; shareUrl: string }>(
        `/api/v1/admin/galleries/${galleryId}/grants`,
        {
          clientId: clientId === "" ? null : clientId,
          label: label.trim() === "" ? null : label,
          permissions: { view, favorite, download },
          password: password === "" ? null : password,
          expiresAt: localInputToIso(expiresAt),
        },
      );
      setShareUrl(res.shareUrl);
      onCreated();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Create share link">
      {shareUrl ? (
        <div className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This link is shown only once. Copy it now.
          </p>
          <ShareUrlBox url={shareUrl} />
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Client (optional)" htmlFor="grant-client">
            <Select
              id="grant-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">No client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Label" htmlFor="grant-label">
            <Input
              id="grant-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Client preview"
            />
          </Field>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <label className="flex items-center gap-2 text-sm">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={view}
                onChange={(e) => setView(e.target.checked)}
              />
              View
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={favorite}
                onChange={(e) => setFavorite(e.target.checked)}
              />
              Favorite
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Input
                type="checkbox"
                className="h-4 w-4"
                checked={download}
                onChange={(e) => setDownload(e.target.checked)}
              />
              Download
            </label>
          </div>
          <Field label="Password (optional)" htmlFor="grant-password">
            <Input
              id="grant-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Field label="Expires at (optional)" htmlFor="grant-expires">
            <Input
              id="grant-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function grantStatus(g: Grant): { tone: "red" | "amber" | "green"; label: string } {
  if (g.revokedAt) return { tone: "red", label: "Revoked" };
  if (g.expiresAt && new Date(g.expiresAt).getTime() < Date.now())
    return { tone: "amber", label: "Expired" };
  return { tone: "green", label: "Active" };
}

function GrantsCard({ galleryId }: { galleryId: string }) {
  const { toast } = useToast();
  const { runWithStepUp } = useStepUp();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [rotatedUrl, setRotatedUrl] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Grant[] }>(
        `/api/v1/admin/galleries/${galleryId}/grants`,
      );
      setGrants(res.data);
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setLoading(false);
    }
  }, [galleryId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusyId(id);
    try {
      await runWithStepUp(() =>
        api.post(`/api/v1/admin/grants/${id}/revoke`),
      );
      toast("Link revoked", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const rotate = async (id: string) => {
    setBusyId(id);
    try {
      const res = await runWithStepUp(() =>
        api.post<{ shareUrl: string }>(`/api/v1/admin/grants/${id}/rotate`),
      );
      setRotatedUrl(res.shareUrl);
      toast("Link rotated", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Share links</CardTitle>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create link
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : grants.length === 0 ? (
          <EmptyState
            title="No share links"
            description="Create a link to share this gallery."
          />
        ) : (
          <ul className="space-y-3">
            {grants.map((g) => {
              const st = grantStatus(g);
              return (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {g.label || "Untitled link"}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <Eye
                          className={
                            "h-3.5 w-3.5 " + (g.canView ? "" : "opacity-30")
                          }
                        />
                        View
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart
                          className={
                            "h-3.5 w-3.5 " + (g.canFavorite ? "" : "opacity-30")
                          }
                        />
                        Favorite
                      </span>
                      <span className="flex items-center gap-1">
                        <Download
                          className={
                            "h-3.5 w-3.5 " + (g.canDownload ? "" : "opacity-30")
                          }
                        />
                        Download
                      </span>
                      <span>{g.accessCount} views</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rotate(g.id)}
                      disabled={busyId === g.id}
                    >
                      Rotate
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => revoke(g.id)}
                      disabled={busyId === g.id || !!g.revokedAt}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {showCreate && (
        <CreateGrantModal
          galleryId={galleryId}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {rotatedUrl && (
        <Modal
          open
          onClose={() => setRotatedUrl(null)}
          title="New share link"
        >
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              This link is shown only once. Copy it now.
            </p>
            <ShareUrlBox url={rotatedUrl} />
            <div className="flex justify-end">
              <Button onClick={() => setRotatedUrl(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

// Per-gallery layout. Stored as a page_config (scope "gallery") referenced by
// gallery.pageConfigId; the public gallery page resolves it via
// resolveRenderConfig("gallery", pageConfigId, …). Controls + live preview.
function LayoutCard({
  gallery,
  onSaved,
}: {
  gallery: Gallery;
  onSaved: (g: Gallery) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gridType, setGridType] = useState<PreviewGrid>("justified");
  const [spacing, setSpacing] = useState<PreviewSpacing>("normal");
  const [theme, setTheme] = useState<PreviewTheme>("auto");

  useEffect(() => {
    let active = true;
    if (!gallery.pageConfigId) {
      setLoading(false);
      return;
    }
    api
      .get<{ gridType: string | null; spacing: string | null; theme: string | null }>(
        `/api/v1/admin/page-configs/${gallery.pageConfigId}`,
      )
      .then((cfg) => {
        if (!active) return;
        if (cfg.gridType === "masonry" || cfg.gridType === "justified" || cfg.gridType === "uniform")
          setGridType(cfg.gridType);
        if (cfg.spacing === "tight" || cfg.spacing === "normal" || cfg.spacing === "airy")
          setSpacing(cfg.spacing);
        if (cfg.theme === "light" || cfg.theme === "dark" || cfg.theme === "auto")
          setTheme(cfg.theme);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [gallery.pageConfigId]);

  const save = async () => {
    setSaving(true);
    try {
      let id = gallery.pageConfigId;
      if (!id) {
        const res = await api.post<{ data: { id: string } }>("/api/v1/admin/page-configs", {
          scope: "gallery",
          gridType,
          spacing,
          theme,
          hero: { enabled: false },
          config: {},
        });
        id = res.data.id;
        await api.patch(`/api/v1/admin/galleries/${gallery.id}`, { pageConfigId: id });
        onSaved({ ...gallery, pageConfigId: id });
      } else {
        await api.patch(`/api/v1/admin/page-configs/${id}`, { gridType, spacing, theme });
      }
      toast("Layout saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layout</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <Field label="Grid type">
                <Select value={gridType} onChange={(e) => setGridType(e.target.value as PreviewGrid)}>
                  <option value="masonry">Masonry</option>
                  <option value="justified">Justified</option>
                  <option value="uniform">Uniform</option>
                </Select>
              </Field>
              <Field label="Spacing">
                <Select value={spacing} onChange={(e) => setSpacing(e.target.value as PreviewSpacing)}>
                  <option value="tight">Tight</option>
                  <option value="normal">Normal</option>
                  <option value="airy">Airy</option>
                </Select>
              </Field>
              <Field label="Theme">
                <Select value={theme} onChange={(e) => setTheme(e.target.value as PreviewTheme)}>
                  <option value="auto">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </Field>
              <div className="pt-1">
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save layout
                </Button>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                This gallery&rsquo;s own layout. Galleries without one use the default
                justified grid.
              </p>
            </div>
            <LivePreview
              baseUrl={`/preview/gallery/${gallery.id}`}
              draft={{ gridType, spacing, theme }}
              height={560}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GalleryEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ data?: Gallery } | Gallery>(`/api/v1/admin/galleries/${id}`)
      .then((res) => {
        if (!active) return;
        const g =
          res && typeof res === "object" && "data" in res && res.data
            ? res.data
            : (res as Gallery);
        setGallery(g);
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
  }, [id, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/galleries"
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Galleries
        </Link>
        <EmptyState
          title="Gallery not found"
          description="It may have been deleted."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/galleries"
          className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Galleries
        </Link>
        <h1 className="text-xl font-semibold">{gallery.title}</h1>
      </div>

      <SettingsCard gallery={gallery} onSaved={setGallery} />
      <LayoutCard gallery={gallery} onSaved={setGallery} />
      <PhotosCard galleryId={gallery.id} />
      <GrantsCard galleryId={gallery.id} />
      <GalleryVideoCard galleryId={gallery.id} />
    </div>
  );
}
