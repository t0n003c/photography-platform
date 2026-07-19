"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Heart,
  Loader2,
  Mail,
  Plus,
  Send,
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
  type PreviewImageTrailVariant,
  type PreviewRotatingScrollVariant,
  type PreviewSpacing,
  type PreviewTheme,
  type PreviewOverlay,
} from "@/components/admin/live-preview";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { useStepUp } from "@/components/admin/step-up";
import { ResponsiveImage } from "@/components/gallery/responsive-image";
import { api, ApiError } from "@/src/lib/api-client";
import type { PhotoDTO } from "@/src/db/queries/photos";

type Visibility = "public" | "private";
type Status = "draft" | "published" | "archived";
type InvitePreviewMode = "content" | "cover" | "none";
type InviteMessageLayout =
  | "classic"
  | "editorial"
  | "personal"
  | "proofing"
  | "private-access";
const DEFAULT_PALMER_BACKGROUND = "#f1f1f1";
const DEFAULT_PALMER_TEXT = "#313131";
const DEFAULT_SLIPHOVER_BACKGROUND = "#f3eadb";
const LEGACY_SLIPHOVER_DARK_BACKGROUND = "#242625";
const DEFAULT_SLIPHOVER_LABEL_BACKGROUND = "#111111";
const DEFAULT_SLIPHOVER_LABEL_TEXT = "#f8f3df";
const DEFAULT_TORA_JUSTIFIED_BACKGROUND = "#252626";
const DEFAULT_TORA_JUSTIFIED_TITLE = "#f7f7f7";
const DEFAULT_TORA_JUSTIFIED_ACCENT = "#edd8aa";

type ToraTextSource = "auto" | "headline" | "alt" | "caption";
type ToraSliphoverLabelSource = ToraTextSource;

function normalizeSliphoverBackground(value: string) {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === DEFAULT_SLIPHOVER_BACKGROUND ||
    normalized === LEGACY_SLIPHOVER_DARK_BACKGROUND
  ) {
    return DEFAULT_SLIPHOVER_BACKGROUND;
  }
  return value;
}

interface Gallery {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  shootDate: string | null;
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
  hasPassword: boolean;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
}

interface InviteDraft {
  shareUrl: string;
  clientId: string | null;
  password: string;
  expiresAt: string | null;
  hasStoredPassword: boolean;
  permissions: {
    favorite: boolean;
    download: boolean;
  };
}

interface GalleryInviteEmailPreview {
  label: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  sent: boolean;
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

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function CollapsibleCard({
  title,
  actions,
  defaultOpen = true,
  children,
}: {
  title: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
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
          <CardTitle>{title}</CardTitle>
        </button>
        {actions}
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
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
  const [subtitle, setSubtitle] = useState(gallery.subtitle ?? "");
  const [description, setDescription] = useState(gallery.description ?? "");
  const [shootDate, setShootDate] = useState(isoToDateInput(gallery.shootDate));
  const [visibility, setVisibility] = useState<Visibility>(gallery.visibility);
  const [status, setStatus] = useState<Status>(gallery.status);
  const [downloadEnabled, setDownloadEnabled] = useState(gallery.downloadEnabled);
  const [expiresAt, setExpiresAt] = useState(isoToLocalInput(gallery.expiresAt));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ data?: Gallery } | Gallery>(
        `/api/v1/admin/galleries/${gallery.id}`,
        {
          title,
          subtitle: subtitle.trim() === "" ? null : subtitle,
          description: description.trim() === "" ? null : description,
          shootDate: dateInputToIso(shootDate),
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
    <CollapsibleCard
      title="Settings"
      actions={
        showPublicLink ? (
          <Link
            href={`/galleries/${gallery.slug}`}
            target="_blank"
            className="text-sm text-[hsl(var(--primary))] underline"
          >
            View public page
          </Link>
        ) : null
      }
    >
      <div className="space-y-4">
        <Field label="Title" htmlFor="g-title">
          <Input
            id="g-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field label="Subtitle" htmlFor="g-subtitle">
          <Input
            id="g-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
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
        <Field label="Shoot date" htmlFor="g-shoot-date">
          <Input
            id="g-shoot-date"
            type="date"
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
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
      </div>
    </CollapsibleCard>
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
      api.get<{ data: PhotoDTO[] }>(`/api/v1/admin/galleries/${galleryId}/photos`),
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
    <CollapsibleCard
      title="Photos"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-sm text-[hsl(var(--muted-foreground))]">
            {selected.length} selected
          </span>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save photos
          </Button>
        </div>
      }
    >
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
                  const hasVariants = !!photo && photo.variants.length > 0;
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
                        (dragId === id
                          ? "opacity-50 ring-2 ring-[hsl(var(--ring))]"
                          : "")
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
                          <Badge tone="amber">{photo ? "Processing" : "Missing"}</Badge>
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
                          backgroundColor: photo.dominantColor ?? "hsl(var(--muted))",
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
    </CollapsibleCard>
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

function GalleryInviteEmailModal({
  galleryId,
  draft,
  onClose,
}: {
  galleryId: string;
  draft: InviteDraft;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [message, setMessage] = useState(
    "Thank you again for the session. Your gallery is ready whenever you have a moment to look through it.",
  );
  const [includePassword, setIncludePassword] = useState(Boolean(draft.password));
  const [password, setPassword] = useState(draft.password);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [messageLayout, setMessageLayout] = useState<InviteMessageLayout>("classic");
  const [previewMode, setPreviewMode] = useState<InvitePreviewMode>("content");
  const [preview, setPreview] = useState<GalleryInviteEmailPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);

  const buildPayload = (send: boolean) => ({
    clientId: draft.clientId,
    to: draft.clientId ? undefined : recipientEmail.trim(),
    clientName: draft.clientId ? undefined : clientName.trim() || null,
    shareUrl: draft.shareUrl,
    message: message.trim() || null,
    password: includePassword && password.trim() ? password.trim() : null,
    expiresAt: draft.expiresAt,
    permissions: draft.permissions,
    messageLayout,
    previewMode,
    send,
  });

  const generate = async (send: boolean) => {
    if (send) setSending(true);
    else setPreviewing(true);
    try {
      const res = await api.post<{ data: GalleryInviteEmailPreview }>(
        `/api/v1/admin/galleries/${galleryId}/invite-email`,
        buildPayload(send),
      );
      setPreview(res.data);
      toast(send ? "Gallery invite sent" : "Gallery invite generated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setPreviewing(false);
      setSending(false);
    }
  };

  const copyEmail = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(
        `To: ${preview.to}\nSubject: ${preview.subject}\n\n${preview.text}`,
      );
      toast("Email copied", "success");
    } catch {
      toast("Could not copy email", "error");
    }
  };

  const openMailApp = () => {
    if (!preview) return;
    const url = `mailto:${encodeURIComponent(preview.to)}?subject=${encodeURIComponent(
      preview.subject,
    )}&body=${encodeURIComponent(preview.text)}`;
    window.location.href = url;
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Prepare gallery email"
      className="w-[min(96vw,64rem)]"
    >
      <div className="space-y-4">
        {!draft.clientId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recipient email" htmlFor="invite-email-to">
              <Input
                id="invite-email-to"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </Field>
            <Field label="Client name" htmlFor="invite-email-name">
              <Input
                id="invite-email-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client name"
              />
            </Field>
          </div>
        )}

        <Field label="Message" htmlFor="invite-email-message">
          <Textarea
            id="invite-email-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </Field>

        <Field
          label="Message layout"
          htmlFor="invite-email-message-layout"
          hint="Choose the visual structure for the generated email content."
        >
          <Select
            id="invite-email-message-layout"
            value={messageLayout}
            onChange={(e) => setMessageLayout(e.target.value as InviteMessageLayout)}
          >
            <option value="classic">Classic invite</option>
            <option value="editorial">Editorial cover</option>
            <option value="personal">Personal note</option>
            <option value="proofing">Proofing focus</option>
            <option value="private-access">Private access</option>
          </Select>
        </Field>

        <Field
          label="Gallery preview"
          htmlFor="invite-email-preview-mode"
          hint="Content preview shows a small image set. Cover image uses the gallery cover when available."
        >
          <Select
            id="invite-email-preview-mode"
            value={previewMode}
            onChange={(e) => setPreviewMode(e.target.value as InvitePreviewMode)}
          >
            <option value="content">Content preview</option>
            <option value="cover">Cover image only</option>
            <option value="none">No image preview</option>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field
            label="Password to include"
            htmlFor="invite-email-password"
            hint={
              draft.hasStoredPassword && !draft.password
                ? "Existing passwords are stored hashed. Enter it here only if you want it included."
                : undefined
            }
          >
            <div className="relative">
              <Input
                id="invite-email-password"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to omit"
                className="pr-10"
              />
              <button
                type="button"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <Input
              type="checkbox"
              className="h-4 w-4"
              checked={includePassword}
              onChange={(e) => setIncludePassword(e.target.checked)}
            />
            Include password
          </label>
        </div>

        <div className="rounded-lg border bg-[hsl(var(--muted))] p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Share link
          </p>
          <ShareUrlBox url={draft.shareUrl} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void generate(false)}
            disabled={previewing || sending}
          >
            {previewing && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate email
          </Button>
          <Button
            type="button"
            onClick={() => void generate(true)}
            disabled={previewing || sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send now
          </Button>
        </div>

        {preview && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid gap-3 rounded-lg border bg-[hsl(var(--muted))] p-3 text-sm sm:grid-cols-[8rem_1fr]">
              <span className="font-medium text-[hsl(var(--muted-foreground))]">
                To
              </span>
              <span className="break-words">{preview.to}</span>
              <span className="font-medium text-[hsl(var(--muted-foreground))]">
                Subject
              </span>
              <span className="break-words">{preview.subject}</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={copyEmail}>
                <Copy className="h-4 w-4" />
                Copy email
              </Button>
              <Button type="button" variant="outline" onClick={openMailApp}>
                <Mail className="h-4 w-4" />
                Open mail app
              </Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">HTML preview</h3>
                <iframe
                  title="Gallery invite HTML preview"
                  srcDoc={preview.html}
                  sandbox=""
                  className="h-[26rem] w-full rounded-lg border bg-white"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Plain text</h3>
                <pre className="h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg border bg-[hsl(var(--muted))] p-3 text-xs leading-relaxed">
                  {preview.text}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function CreateGrantModal({
  galleryId,
  onClose,
  onCreated,
  onPrepareEmail,
}: {
  galleryId: string;
  onClose: () => void;
  onCreated: () => void;
  onPrepareEmail: (draft: InviteDraft) => void;
}) {
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [label, setLabel] = useState("");
  const [view, setView] = useState(true);
  const [favorite, setFavorite] = useState(true);
  const [download, setDownload] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [createdGrant, setCreatedGrant] = useState<Grant | null>(null);

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
      setCreatedGrant(res.grant);
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
          <div className="flex flex-wrap justify-end gap-2">
            {createdGrant && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onPrepareEmail({
                    shareUrl,
                    clientId: createdGrant.clientId,
                    password,
                    expiresAt: createdGrant.expiresAt,
                    hasStoredPassword: createdGrant.hasPassword,
                    permissions: {
                      favorite: createdGrant.canFavorite,
                      download: createdGrant.canDownload,
                    },
                  });
                }}
              >
                <Mail className="h-4 w-4" />
                Prepare email
              </Button>
            )}
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
            <div className="relative">
              <Input
                id="grant-password"
                type={passwordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
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
  const [rotatedInvite, setRotatedInvite] = useState<InviteDraft | null>(null);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
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
      await runWithStepUp(() => api.post(`/api/v1/admin/grants/${id}/revoke`));
      toast("Link revoked", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  const rotate = async (grant: Grant) => {
    setBusyId(grant.id);
    try {
      const res = await runWithStepUp(() =>
        api.post<{ shareUrl: string }>(`/api/v1/admin/grants/${grant.id}/rotate`),
      );
      setRotatedInvite({
        shareUrl: res.shareUrl,
        clientId: grant.clientId,
        password: "",
        expiresAt: grant.expiresAt,
        hasStoredPassword: grant.hasPassword,
        permissions: {
          favorite: grant.canFavorite,
          download: grant.canDownload,
        },
      });
      toast("Link rotated", "success");
      await load();
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <CollapsibleCard
        title="Share links"
        actions={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create link
          </Button>
        }
      >
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
                      {g.hasPassword && <Badge>Password</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className="flex items-center gap-1">
                        <Eye
                          className={"h-3.5 w-3.5 " + (g.canView ? "" : "opacity-30")}
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
                      onClick={() => rotate(g)}
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
      </CollapsibleCard>

      {showCreate && (
        <CreateGrantModal
          galleryId={galleryId}
          onClose={() => setShowCreate(false)}
          onCreated={load}
          onPrepareEmail={(draft) => {
            setInviteDraft(draft);
            setShowCreate(false);
          }}
        />
      )}

      {rotatedInvite && (
        <Modal open onClose={() => setRotatedInvite(null)} title="New share link">
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              This link is shown only once. Copy it now.
            </p>
            <ShareUrlBox url={rotatedInvite.shareUrl} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setInviteDraft(rotatedInvite);
                  setRotatedInvite(null);
                }}
              >
                <Mail className="h-4 w-4" />
                Prepare email
              </Button>
              <Button onClick={() => setRotatedInvite(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}

      {inviteDraft && (
        <GalleryInviteEmailModal
          galleryId={galleryId}
          draft={inviteDraft}
          onClose={() => setInviteDraft(null)}
        />
      )}
    </>
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
  const [discourageImageSaving, setDiscourageImageSaving] = useState(false);
  const [overlay, setOverlay] = useState<PreviewOverlay>("minimal");
  const [altUseBackground, setAltUseBackground] = useState(true);
  const [altBackgroundColor, setAltBackgroundColor] = useState("#b7b19f");
  const [altTextColor, setAltTextColor] = useState("#111111");
  const [altShowText, setAltShowText] = useState(true);
  const [imgTrailVariant, setImgTrailVariant] =
    useState<PreviewImageTrailVariant>("fade-shrink");
  const [imgTrailUseBackground, setImgTrailUseBackground] = useState(true);
  const [imgTrailBackgroundColor, setImgTrailBackgroundColor] = useState("#efece5");
  const [rotatingVariant, setRotatingVariant] =
    useState<PreviewRotatingScrollVariant>("demo5");
  const [rotatingUseBackground, setRotatingUseBackground] = useState(true);
  const [rotatingBackgroundColor, setRotatingBackgroundColor] = useState("#141414");
  const [rotatingMarqueeText, setRotatingMarqueeText] = useState("");
  const [diagonalUseBackground, setDiagonalUseBackground] = useState(true);
  const [diagonalBackgroundColor, setDiagonalBackgroundColor] = useState("#0c0c0c");
  const [diagonalTextColor, setDiagonalTextColor] = useState("#f1f1f1");
  const [diagonalDecoColor, setDiagonalDecoColor] = useState("#141414");
  const [diagonalSideText, setDiagonalSideText] = useState("");
  const [diagonalShowSideText, setDiagonalShowSideText] = useState(true);
  const [diagonalShowDetail, setDiagonalShowDetail] = useState(true);
  const [depthUseMoodBackground, setDepthUseMoodBackground] = useState(true);
  const [depthShowTrail, setDepthShowTrail] = useState(true);
  const [depthShowParticles, setDepthShowParticles] = useState(true);
  const [depthLabelStyle, setDepthLabelStyle] = useState<
    "color-chip" | "metadata" | "minimal"
  >("color-chip");
  const [depthScrollSpeed, setDepthScrollSpeed] = useState<"slow" | "normal" | "fast">(
    "normal",
  );
  const [depthBackgroundColor, setDepthBackgroundColor] = useState("#fffaf0");
  const [infiniteBackgroundColor, setInfiniteBackgroundColor] = useState("#f4f1ea");
  const [infiniteFogColor, setInfiniteFogColor] = useState("#f4f1ea");
  const [infiniteDensity, setInfiniteDensity] = useState<"sparse" | "normal" | "dense">(
    "normal",
  );
  const [infiniteImageSize, setInfiniteImageSize] = useState<
    "small" | "medium" | "large"
  >("medium");
  const [infiniteMovement, setInfiniteMovement] = useState<"slow" | "normal" | "fast">(
    "normal",
  );
  const [infiniteShowControls, setInfiniteShowControls] = useState(true);
  const [infiniteEnableKeyboard, setInfiniteEnableKeyboard] = useState(true);
  const [palmerDensity, setPalmerDensity] = useState<"compact" | "normal" | "wide">(
    "normal",
  );
  const [palmerItemSize, setPalmerItemSize] = useState<"small" | "medium" | "large">(
    "medium",
  );
  const [palmerShowDetails, setPalmerShowDetails] = useState(true);
  const [palmerUseCustomColors, setPalmerUseCustomColors] = useState(false);
  const [palmerBackgroundColor, setPalmerBackgroundColor] = useState(
    DEFAULT_PALMER_BACKGROUND,
  );
  const [palmerTextColor, setPalmerTextColor] = useState(DEFAULT_PALMER_TEXT);
  const [toraSliphoverUseBackground, setToraSliphoverUseBackground] = useState(true);
  const [toraSliphoverBackgroundColor, setToraSliphoverBackgroundColor] = useState(
    DEFAULT_SLIPHOVER_BACKGROUND,
  );
  const [toraSliphoverLabelSource, setToraSliphoverLabelSource] =
    useState<ToraSliphoverLabelSource>("auto");
  const [toraSliphoverLabelBackgroundColor, setToraSliphoverLabelBackgroundColor] =
    useState(DEFAULT_SLIPHOVER_LABEL_BACKGROUND);
  const [toraSliphoverLabelTextColor, setToraSliphoverLabelTextColor] = useState(
    DEFAULT_SLIPHOVER_LABEL_TEXT,
  );
  const [toraJustifiedUseBackground, setToraJustifiedUseBackground] = useState(true);
  const [toraJustifiedBackgroundColor, setToraJustifiedBackgroundColor] = useState(
    DEFAULT_TORA_JUSTIFIED_BACKGROUND,
  );
  const [toraJustifiedTitleColor, setToraJustifiedTitleColor] = useState(
    DEFAULT_TORA_JUSTIFIED_TITLE,
  );
  const [toraJustifiedAccentColor, setToraJustifiedAccentColor] = useState(
    DEFAULT_TORA_JUSTIFIED_ACCENT,
  );
  const [toraJustifiedTitleSource, setToraJustifiedTitleSource] =
    useState<ToraTextSource>("auto");
  const [toraJustifiedRowHeightFactor, setToraJustifiedRowHeightFactor] = useState(7);
  const [toraJustifiedDesktopGutter, setToraJustifiedDesktopGutter] = useState(25);
  const [toraJustifiedMobileGutter, setToraJustifiedMobileGutter] = useState(15);
  const [toraJustifiedHoverInset, setToraJustifiedHoverInset] = useState(true);
  const [toraJustifiedDimOnLeadHover, setToraJustifiedDimOnLeadHover] = useState(true);
  const [toraJustifiedScrollOnSelect, setToraJustifiedScrollOnSelect] = useState(true);
  const [toraJustifiedShowBlurredSideFill, setToraJustifiedShowBlurredSideFill] =
    useState(true);
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let active = true;
    if (!gallery.pageConfigId) {
      setLoading(false);
      return;
    }
    api
      .get<{
        gridType: string | null;
        spacing: string | null;
        theme: string | null;
        config: Record<string, unknown> | null;
      }>(`/api/v1/admin/page-configs/${gallery.pageConfigId}`)
      .then((cfg) => {
        if (!active) return;
        if (
          cfg.gridType === "masonry" ||
          cfg.gridType === "justified" ||
          cfg.gridType === "uniform" ||
          cfg.gridType === "horizontal-lenis" ||
          cfg.gridType === "parallax-ring" ||
          cfg.gridType === "image-trail" ||
          cfg.gridType === "rotating-scroll" ||
          cfg.gridType === "diagonal-slideshow" ||
          cfg.gridType === "depth-gallery" ||
          cfg.gridType === "infinite-canvas" ||
          cfg.gridType === "css-glitch" ||
          cfg.gridType === "palmer-draggable" ||
          cfg.gridType === "tora-sliphover" ||
          cfg.gridType === "tora-justified-showcase" ||
          cfg.gridType === "alternative-scroll"
        )
          setGridType(cfg.gridType);
        if (
          cfg.spacing === "tight" ||
          cfg.spacing === "normal" ||
          cfg.spacing === "airy"
        )
          setSpacing(cfg.spacing);
        if (cfg.theme === "light" || cfg.theme === "dark" || cfg.theme === "auto")
          setTheme(cfg.theme);
        const c = (cfg.config ?? {}) as Record<string, unknown>;
        setBaseConfig(c);
        if (typeof c.discourageImageSaving === "boolean") {
          setDiscourageImageSaving(c.discourageImageSaving);
        }
        const o = c.hlOverlay;
        if (o === "minimal" || o === "editorial" || o === "centered") setOverlay(o);
        if (typeof c.altUseBackground === "boolean") {
          setAltUseBackground(c.altUseBackground);
        }
        if (typeof c.altBackgroundColor === "string") {
          setAltBackgroundColor(c.altBackgroundColor);
        }
        if (typeof c.altTextColor === "string") {
          setAltTextColor(c.altTextColor);
        }
        if (typeof c.altShowText === "boolean") {
          setAltShowText(c.altShowText);
        }
        const trailVariant = c.imgTrailVariant;
        if (
          trailVariant === "fade-shrink" ||
          trailVariant === "zoom-fade" ||
          trailVariant === "drop" ||
          trailVariant === "scatter" ||
          trailVariant === "stretch-drop" ||
          trailVariant === "full-frame"
        ) {
          setImgTrailVariant(trailVariant);
        }
        if (typeof c.imgTrailUseBackground === "boolean") {
          setImgTrailUseBackground(c.imgTrailUseBackground);
        }
        if (typeof c.imgTrailBackgroundColor === "string") {
          setImgTrailBackgroundColor(c.imgTrailBackgroundColor);
        }
        const rotatingScrollVariant = c.rotatingScrollVariant;
        if (
          rotatingScrollVariant === "demo1" ||
          rotatingScrollVariant === "demo2" ||
          rotatingScrollVariant === "demo3" ||
          rotatingScrollVariant === "demo4" ||
          rotatingScrollVariant === "demo5"
        ) {
          setRotatingVariant(rotatingScrollVariant);
        }
        if (typeof c.rotatingScrollUseBackground === "boolean") {
          setRotatingUseBackground(c.rotatingScrollUseBackground);
        }
        if (typeof c.rotatingScrollBackgroundColor === "string") {
          setRotatingBackgroundColor(c.rotatingScrollBackgroundColor);
        }
        if (typeof c.rotatingScrollMarqueeText === "string") {
          setRotatingMarqueeText(c.rotatingScrollMarqueeText);
        }
        if (typeof c.diagonalUseBackground === "boolean") {
          setDiagonalUseBackground(c.diagonalUseBackground);
        }
        if (typeof c.diagonalBackgroundColor === "string") {
          setDiagonalBackgroundColor(c.diagonalBackgroundColor);
        }
        if (typeof c.diagonalTextColor === "string") {
          setDiagonalTextColor(c.diagonalTextColor);
        }
        if (typeof c.diagonalDecoColor === "string") {
          setDiagonalDecoColor(c.diagonalDecoColor);
        }
        if (typeof c.diagonalSideText === "string") {
          setDiagonalSideText(c.diagonalSideText);
        }
        if (typeof c.diagonalShowSideText === "boolean") {
          setDiagonalShowSideText(c.diagonalShowSideText);
        }
        if (typeof c.diagonalShowDetail === "boolean") {
          setDiagonalShowDetail(c.diagonalShowDetail);
        }
        if (typeof c.depthUseMoodBackground === "boolean") {
          setDepthUseMoodBackground(c.depthUseMoodBackground);
        }
        if (typeof c.depthShowTrail === "boolean") {
          setDepthShowTrail(c.depthShowTrail);
        }
        if (typeof c.depthShowParticles === "boolean") {
          setDepthShowParticles(c.depthShowParticles);
        }
        if (
          c.depthLabelStyle === "color-chip" ||
          c.depthLabelStyle === "metadata" ||
          c.depthLabelStyle === "minimal"
        ) {
          setDepthLabelStyle(c.depthLabelStyle);
        }
        if (
          c.depthScrollSpeed === "slow" ||
          c.depthScrollSpeed === "normal" ||
          c.depthScrollSpeed === "fast"
        ) {
          setDepthScrollSpeed(c.depthScrollSpeed);
        }
        if (typeof c.depthBackgroundColor === "string") {
          setDepthBackgroundColor(c.depthBackgroundColor);
        }
        if (typeof c.infiniteBackgroundColor === "string") {
          setInfiniteBackgroundColor(c.infiniteBackgroundColor);
        }
        if (typeof c.infiniteFogColor === "string") {
          setInfiniteFogColor(c.infiniteFogColor);
        }
        if (
          c.infiniteDensity === "sparse" ||
          c.infiniteDensity === "normal" ||
          c.infiniteDensity === "dense"
        ) {
          setInfiniteDensity(c.infiniteDensity);
        }
        if (
          c.infiniteImageSize === "small" ||
          c.infiniteImageSize === "medium" ||
          c.infiniteImageSize === "large"
        ) {
          setInfiniteImageSize(c.infiniteImageSize);
        }
        if (
          c.infiniteMovement === "slow" ||
          c.infiniteMovement === "normal" ||
          c.infiniteMovement === "fast"
        ) {
          setInfiniteMovement(c.infiniteMovement);
        }
        if (typeof c.infiniteShowControls === "boolean") {
          setInfiniteShowControls(c.infiniteShowControls);
        }
        if (typeof c.infiniteEnableKeyboard === "boolean") {
          setInfiniteEnableKeyboard(c.infiniteEnableKeyboard);
        }
        const palmerDensityValue = c.palmerDensity;
        if (
          palmerDensityValue === "compact" ||
          palmerDensityValue === "normal" ||
          palmerDensityValue === "wide"
        ) {
          setPalmerDensity(palmerDensityValue);
        }
        const palmerItemSizeValue = c.palmerItemSize;
        if (
          palmerItemSizeValue === "small" ||
          palmerItemSizeValue === "medium" ||
          palmerItemSizeValue === "large"
        ) {
          setPalmerItemSize(palmerItemSizeValue);
        }
        if (typeof c.palmerShowDetails === "boolean") {
          setPalmerShowDetails(c.palmerShowDetails);
        }
        if (typeof c.palmerUseCustomColors === "boolean") {
          setPalmerUseCustomColors(c.palmerUseCustomColors);
        } else {
          const savedBackground =
            typeof c.palmerBackgroundColor === "string"
              ? c.palmerBackgroundColor
              : DEFAULT_PALMER_BACKGROUND;
          const savedText =
            typeof c.palmerTextColor === "string"
              ? c.palmerTextColor
              : DEFAULT_PALMER_TEXT;
          setPalmerUseCustomColors(
            savedBackground.toLowerCase() !== DEFAULT_PALMER_BACKGROUND ||
              savedText.toLowerCase() !== DEFAULT_PALMER_TEXT,
          );
        }
        if (typeof c.palmerBackgroundColor === "string") {
          setPalmerBackgroundColor(c.palmerBackgroundColor);
        }
        if (typeof c.palmerTextColor === "string") {
          setPalmerTextColor(c.palmerTextColor);
        }
        if (typeof c.toraSliphoverUseBackground === "boolean") {
          setToraSliphoverUseBackground(c.toraSliphoverUseBackground);
        }
        if (typeof c.toraSliphoverBackgroundColor === "string") {
          setToraSliphoverBackgroundColor(
            normalizeSliphoverBackground(c.toraSliphoverBackgroundColor),
          );
        }
        if (
          c.toraSliphoverLabelSource === "auto" ||
          c.toraSliphoverLabelSource === "headline" ||
          c.toraSliphoverLabelSource === "alt" ||
          c.toraSliphoverLabelSource === "caption"
        ) {
          setToraSliphoverLabelSource(c.toraSliphoverLabelSource);
        }
        if (typeof c.toraSliphoverLabelBackgroundColor === "string") {
          setToraSliphoverLabelBackgroundColor(c.toraSliphoverLabelBackgroundColor);
        }
        if (typeof c.toraSliphoverLabelTextColor === "string") {
          setToraSliphoverLabelTextColor(c.toraSliphoverLabelTextColor);
        }
        if (typeof c.toraJustifiedUseBackground === "boolean") {
          setToraJustifiedUseBackground(c.toraJustifiedUseBackground);
        }
        if (typeof c.toraJustifiedBackgroundColor === "string") {
          setToraJustifiedBackgroundColor(c.toraJustifiedBackgroundColor);
        }
        if (typeof c.toraJustifiedTitleColor === "string") {
          setToraJustifiedTitleColor(c.toraJustifiedTitleColor);
        }
        if (typeof c.toraJustifiedAccentColor === "string") {
          setToraJustifiedAccentColor(c.toraJustifiedAccentColor);
        }
        if (
          c.toraJustifiedTitleSource === "auto" ||
          c.toraJustifiedTitleSource === "headline" ||
          c.toraJustifiedTitleSource === "alt" ||
          c.toraJustifiedTitleSource === "caption"
        ) {
          setToraJustifiedTitleSource(c.toraJustifiedTitleSource);
        }
        if (typeof c.toraJustifiedRowHeightFactor === "number") {
          setToraJustifiedRowHeightFactor(
            Math.min(10, Math.max(5, c.toraJustifiedRowHeightFactor)),
          );
        }
        if (typeof c.toraJustifiedDesktopGutter === "number") {
          setToraJustifiedDesktopGutter(
            Math.min(60, Math.max(0, c.toraJustifiedDesktopGutter)),
          );
        }
        if (typeof c.toraJustifiedMobileGutter === "number") {
          setToraJustifiedMobileGutter(
            Math.min(40, Math.max(0, c.toraJustifiedMobileGutter)),
          );
        }
        if (typeof c.toraJustifiedHoverInset === "boolean") {
          setToraJustifiedHoverInset(c.toraJustifiedHoverInset);
        }
        if (typeof c.toraJustifiedDimOnLeadHover === "boolean") {
          setToraJustifiedDimOnLeadHover(c.toraJustifiedDimOnLeadHover);
        }
        if (typeof c.toraJustifiedScrollOnSelect === "boolean") {
          setToraJustifiedScrollOnSelect(c.toraJustifiedScrollOnSelect);
        }
        if (typeof c.toraJustifiedShowBlurredSideFill === "boolean") {
          setToraJustifiedShowBlurredSideFill(c.toraJustifiedShowBlurredSideFill);
        }
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
      const restConfig = { ...baseConfig };
      delete restConfig.motionEffect;
      const config = {
        ...restConfig,
        hlOverlay: overlay,
        discourageImageSaving,
        altUseBackground,
        altBackgroundColor,
        altTextColor,
        altShowText,
        imgTrailVariant,
        imgTrailUseBackground,
        imgTrailBackgroundColor,
        rotatingScrollVariant: rotatingVariant,
        rotatingScrollUseBackground: rotatingUseBackground,
        rotatingScrollBackgroundColor: rotatingBackgroundColor,
        rotatingScrollMarqueeText: rotatingMarqueeText,
        diagonalUseBackground,
        diagonalBackgroundColor,
        diagonalTextColor,
        diagonalDecoColor,
        diagonalSideText,
        diagonalShowSideText,
        diagonalShowDetail,
        depthUseMoodBackground,
        depthShowTrail,
        depthShowParticles,
        depthLabelStyle,
        depthScrollSpeed,
        depthBackgroundColor,
        infiniteBackgroundColor,
        infiniteFogColor,
        infiniteDensity,
        infiniteImageSize,
        infiniteMovement,
        infiniteShowControls,
        infiniteEnableKeyboard,
        palmerDensity,
        palmerItemSize,
        palmerShowDetails,
        palmerUseCustomColors,
        palmerBackgroundColor,
        palmerTextColor,
        toraSliphoverUseBackground,
        toraSliphoverBackgroundColor,
        toraSliphoverLabelSource,
        toraSliphoverLabelBackgroundColor,
        toraSliphoverLabelTextColor,
        toraJustifiedUseBackground,
        toraJustifiedBackgroundColor,
        toraJustifiedTitleColor,
        toraJustifiedAccentColor,
        toraJustifiedTitleSource,
        toraJustifiedRowHeightFactor,
        toraJustifiedDesktopGutter,
        toraJustifiedMobileGutter,
        toraJustifiedHoverInset,
        toraJustifiedDimOnLeadHover,
        toraJustifiedScrollOnSelect,
        toraJustifiedShowBlurredSideFill,
      };
      let id = gallery.pageConfigId;
      if (!id) {
        const res = await api.post<{ data: { id: string } }>(
          "/api/v1/admin/page-configs",
          {
            scope: "gallery",
            gridType,
            spacing,
            theme,
            hero: { enabled: false },
            config,
          },
        );
        id = res.data.id;
        await api.patch(`/api/v1/admin/galleries/${gallery.id}`, { pageConfigId: id });
        onSaved({ ...gallery, pageConfigId: id });
      } else {
        await api.patch(`/api/v1/admin/page-configs/${id}`, {
          gridType,
          spacing,
          theme,
          config,
        });
      }
      setBaseConfig(config);
      toast("Layout saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleCard title="Layout">
      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label="Grid type">
              <Select
                value={gridType}
                onChange={(e) => setGridType(e.target.value as PreviewGrid)}
              >
                <option value="masonry">Masonry</option>
                <option value="justified">Justified</option>
                <option value="tora-justified-showcase">Tora justified showcase</option>
                <option value="uniform">Uniform</option>
                <option value="horizontal-lenis">Horizontal Scroll (Lenis)</option>
                <option value="parallax-ring">Parallax 3D ring</option>
                <option value="image-trail">Image trail cursor</option>
                <option value="rotating-scroll">Rotating on scroll</option>
                <option value="diagonal-slideshow">Diagonal slideshow</option>
                <option value="depth-gallery">Depth gallery</option>
                <option value="infinite-canvas">Infinite canvas</option>
                <option value="css-glitch">Glitch hover grid</option>
                <option value="palmer-draggable">Palmer draggable grid</option>
                <option value="tora-sliphover">Tora sliphover masonry</option>
                <option value="alternative-scroll">Alternative scroll</option>
              </Select>
            </Field>
            {/* The horizontal-scroll & alternative-scroll layouts manage their own spacing. */}
            {gridType !== "horizontal-lenis" &&
              gridType !== "parallax-ring" &&
              gridType !== "image-trail" &&
              gridType !== "rotating-scroll" &&
              gridType !== "diagonal-slideshow" &&
              gridType !== "depth-gallery" &&
              gridType !== "infinite-canvas" &&
              gridType !== "css-glitch" &&
              gridType !== "palmer-draggable" &&
              gridType !== "tora-sliphover" &&
              gridType !== "tora-justified-showcase" &&
              gridType !== "alternative-scroll" && (
                <Field label="Spacing">
                  <Select
                    value={spacing}
                    onChange={(e) => setSpacing(e.target.value as PreviewSpacing)}
                  >
                    <option value="tight">Tight</option>
                    <option value="normal">Normal</option>
                    <option value="airy">Airy</option>
                  </Select>
                </Field>
              )}
            <Field label="Theme">
              <Select
                value={theme}
                onChange={(e) => setTheme(e.target.value as PreviewTheme)}
              >
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </Field>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <Input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={discourageImageSaving}
                onChange={(e) => setDiscourageImageSaving(e.target.checked)}
              />
              <span>
                <span className="block font-medium">
                  Discourage casual image saving
                </span>
                <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                  Disable the image context menu and dragging in this gallery. This is a
                  casual deterrent, not a way to prevent screenshots or determined
                  copying.
                </span>
              </span>
            </label>
            {gridType === "horizontal-lenis" && (
              <Field label="Text overlay">
                <Select
                  value={overlay}
                  onChange={(e) => setOverlay(e.target.value as PreviewOverlay)}
                >
                  <option value="minimal">Minimal — caption over a corner scrim</option>
                  <option value="editorial">
                    Editorial — big titles framing the photo (reference)
                  </option>
                  <option value="centered">
                    Centered — title centered over the photo
                  </option>
                </Select>
              </Field>
            )}
            {gridType === "image-trail" && (
              <div className="space-y-3 rounded-md border p-3">
                <Field label="Demo style">
                  <Select
                    value={imgTrailVariant}
                    onChange={(e) =>
                      setImgTrailVariant(e.target.value as PreviewImageTrailVariant)
                    }
                  >
                    <option value="fade-shrink">Demo 1 — fade + shrink</option>
                    <option value="zoom-fade">Demo 2 — zoom fade</option>
                    <option value="drop">Demo 3 — drop away</option>
                    <option value="scatter">Demo 4 — scatter</option>
                    <option value="stretch-drop">Demo 5 — stretch drop</option>
                    <option value="full-frame">Demo 6 — full-frame sweep</option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field label="Background color" htmlFor="img-trail-bg-color">
                    <Input
                      id="img-trail-bg-color"
                      type="color"
                      value={imgTrailBackgroundColor}
                      onChange={(e) => setImgTrailBackgroundColor(e.target.value)}
                      disabled={!imgTrailUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={imgTrailUseBackground}
                      onChange={(e) => setImgTrailUseBackground(e.target.checked)}
                    />
                    Use background
                  </label>
                </div>
              </div>
            )}
            {gridType === "rotating-scroll" && (
              <div className="space-y-3 rounded-md border p-3">
                <Field label="Demo style">
                  <Select
                    value={rotatingVariant}
                    onChange={(e) =>
                      setRotatingVariant(e.target.value as PreviewRotatingScrollVariant)
                    }
                  >
                    <option value="demo1">Demo 1 - wide rolling cards</option>
                    <option value="demo2">Demo 2 - deep flip</option>
                    <option value="demo3">Demo 3 - tonal reveal</option>
                    <option value="demo4">Demo 4 - velocity blur</option>
                    <option value="demo5">Demo 5 - stacked blur marquee</option>
                  </Select>
                </Field>
                <Field label="Marquee text" htmlFor="rotating-marquee-text">
                  <Input
                    id="rotating-marquee-text"
                    value={rotatingMarqueeText}
                    onChange={(e) => setRotatingMarqueeText(e.target.value)}
                    placeholder="Leave blank to use gallery title"
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field label="Background color" htmlFor="rotating-bg-color">
                    <Input
                      id="rotating-bg-color"
                      type="color"
                      value={rotatingBackgroundColor}
                      onChange={(e) => setRotatingBackgroundColor(e.target.value)}
                      disabled={!rotatingUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={rotatingUseBackground}
                      onChange={(e) => setRotatingUseBackground(e.target.checked)}
                    />
                    Use background
                  </label>
                </div>
              </div>
            )}
            {gridType === "diagonal-slideshow" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Background color" htmlFor="diagonal-bg-color">
                    <Input
                      id="diagonal-bg-color"
                      type="color"
                      value={diagonalBackgroundColor}
                      onChange={(e) => setDiagonalBackgroundColor(e.target.value)}
                      disabled={!diagonalUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Text color" htmlFor="diagonal-text-color">
                    <Input
                      id="diagonal-text-color"
                      type="color"
                      value={diagonalTextColor}
                      onChange={(e) => setDiagonalTextColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Panel color" htmlFor="diagonal-deco-color">
                    <Input
                      id="diagonal-deco-color"
                      type="color"
                      value={diagonalDecoColor}
                      onChange={(e) => setDiagonalDecoColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                </div>
                <Field label="Side text" htmlFor="diagonal-side-text">
                  <Input
                    id="diagonal-side-text"
                    value={diagonalSideText}
                    onChange={(e) => setDiagonalSideText(e.target.value)}
                    placeholder="Leave blank to use photo text"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={diagonalUseBackground}
                      onChange={(e) => setDiagonalUseBackground(e.target.checked)}
                    />
                    Use background color
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={diagonalShowSideText}
                      onChange={(e) => setDiagonalShowSideText(e.target.checked)}
                    />
                    Show side text
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={diagonalShowDetail}
                      onChange={(e) => setDiagonalShowDetail(e.target.checked)}
                    />
                    Show detail preview
                  </label>
                </div>
              </div>
            )}
            {gridType === "depth-gallery" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label style">
                    <Select
                      value={depthLabelStyle}
                      onChange={(e) =>
                        setDepthLabelStyle(
                          e.target.value as "color-chip" | "metadata" | "minimal",
                        )
                      }
                    >
                      <option value="color-chip">Color chip - reference layout</option>
                      <option value="metadata">Photo metadata</option>
                      <option value="minimal">Minimal</option>
                    </Select>
                  </Field>
                  <Field label="Scroll speed">
                    <Select
                      value={depthScrollSpeed}
                      onChange={(e) =>
                        setDepthScrollSpeed(
                          e.target.value as "slow" | "normal" | "fast",
                        )
                      }
                    >
                      <option value="slow">Slow</option>
                      <option value="normal">Normal</option>
                      <option value="fast">Fast</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Fallback background" htmlFor="depth-bg-color">
                  <Input
                    id="depth-bg-color"
                    type="color"
                    value={depthBackgroundColor}
                    onChange={(e) => setDepthBackgroundColor(e.target.value)}
                    disabled={depthUseMoodBackground}
                    className="h-10 p-1"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={depthUseMoodBackground}
                      onChange={(e) => setDepthUseMoodBackground(e.target.checked)}
                    />
                    Use photo mood background
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={depthShowTrail}
                      onChange={(e) => setDepthShowTrail(e.target.checked)}
                    />
                    Show trail
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={depthShowParticles}
                      onChange={(e) => setDepthShowParticles(e.target.checked)}
                    />
                    Show particles
                  </label>
                </div>
              </div>
            )}
            {gridType === "infinite-canvas" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Image density">
                    <Select
                      value={infiniteDensity}
                      onChange={(e) =>
                        setInfiniteDensity(
                          e.target.value as "sparse" | "normal" | "dense",
                        )
                      }
                    >
                      <option value="sparse">Sparse</option>
                      <option value="normal">Normal</option>
                      <option value="dense">Dense</option>
                    </Select>
                  </Field>
                  <Field label="Image size">
                    <Select
                      value={infiniteImageSize}
                      onChange={(e) =>
                        setInfiniteImageSize(
                          e.target.value as "small" | "medium" | "large",
                        )
                      }
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Movement speed">
                  <Select
                    value={infiniteMovement}
                    onChange={(e) =>
                      setInfiniteMovement(e.target.value as "slow" | "normal" | "fast")
                    }
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Background color" htmlFor="infinite-bg-color">
                    <Input
                      id="infinite-bg-color"
                      type="color"
                      value={infiniteBackgroundColor}
                      onChange={(e) => setInfiniteBackgroundColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Fog color" htmlFor="infinite-fog-color">
                    <Input
                      id="infinite-fog-color"
                      type="color"
                      value={infiniteFogColor}
                      onChange={(e) => setInfiniteFogColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={infiniteShowControls}
                      onChange={(e) => setInfiniteShowControls(e.target.checked)}
                    />
                    Show controls hint
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={infiniteEnableKeyboard}
                      onChange={(e) => setInfiniteEnableKeyboard(e.target.checked)}
                    />
                    Enable keyboard movement
                  </label>
                </div>
              </div>
            )}
            {gridType === "alternative-scroll" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Background color" htmlFor="alt-bg-color">
                    <Input
                      id="alt-bg-color"
                      type="color"
                      value={altBackgroundColor}
                      onChange={(e) => setAltBackgroundColor(e.target.value)}
                      disabled={!altUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Text color" htmlFor="alt-text-color">
                    <Input
                      id="alt-text-color"
                      type="color"
                      value={altTextColor}
                      onChange={(e) => setAltTextColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={altUseBackground}
                      onChange={(e) => setAltUseBackground(e.target.checked)}
                    />
                    Use background color
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={altShowText}
                      onChange={(e) => setAltShowText(e.target.checked)}
                    />
                    Show text overlay
                  </label>
                </div>
              </div>
            )}
            {gridType === "tora-sliphover" && (
              <div className="space-y-3 rounded-md border p-3">
                <Field label="Hover label source">
                  <Select
                    value={toraSliphoverLabelSource}
                    onChange={(e) =>
                      setToraSliphoverLabelSource(
                        e.target.value as ToraSliphoverLabelSource,
                      )
                    }
                  >
                    <option value="auto">Auto - headline, alt, then caption</option>
                    <option value="headline">Headline</option>
                    <option value="alt">Alt text</option>
                    <option value="caption">Caption</option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Background color" htmlFor="sliphover-bg-color">
                    <Input
                      id="sliphover-bg-color"
                      type="color"
                      value={toraSliphoverBackgroundColor}
                      onChange={(e) => setToraSliphoverBackgroundColor(e.target.value)}
                      disabled={!toraSliphoverUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Label background" htmlFor="sliphover-label-bg-color">
                    <Input
                      id="sliphover-label-bg-color"
                      type="color"
                      value={toraSliphoverLabelBackgroundColor}
                      onChange={(e) =>
                        setToraSliphoverLabelBackgroundColor(e.target.value)
                      }
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Label text" htmlFor="sliphover-label-text-color">
                    <Input
                      id="sliphover-label-text-color"
                      type="color"
                      value={toraSliphoverLabelTextColor}
                      onChange={(e) => setToraSliphoverLabelTextColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={toraSliphoverUseBackground}
                    onChange={(e) => setToraSliphoverUseBackground(e.target.checked)}
                  />
                  Use background color
                </label>
              </div>
            )}
            {gridType === "tora-justified-showcase" && (
              <div className="space-y-3 rounded-md border p-3">
                <Field label="Title source">
                  <Select
                    value={toraJustifiedTitleSource}
                    onChange={(e) =>
                      setToraJustifiedTitleSource(e.target.value as ToraTextSource)
                    }
                  >
                    <option value="auto">Auto - headline, alt, then caption</option>
                    <option value="headline">Headline</option>
                    <option value="alt">Alt text</option>
                    <option value="caption">Caption</option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Background color" htmlFor="tora-justified-bg-color">
                    <Input
                      id="tora-justified-bg-color"
                      type="color"
                      value={toraJustifiedBackgroundColor}
                      onChange={(e) => setToraJustifiedBackgroundColor(e.target.value)}
                      disabled={!toraJustifiedUseBackground}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Title color" htmlFor="tora-justified-title-color">
                    <Input
                      id="tora-justified-title-color"
                      type="color"
                      value={toraJustifiedTitleColor}
                      onChange={(e) => setToraJustifiedTitleColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                  <Field label="Accent color" htmlFor="tora-justified-accent-color">
                    <Input
                      id="tora-justified-accent-color"
                      type="color"
                      value={toraJustifiedAccentColor}
                      onChange={(e) => setToraJustifiedAccentColor(e.target.value)}
                      className="h-10 p-1"
                    />
                  </Field>
                </div>
                <Field label="Row height">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={5}
                      max={10}
                      step={0.25}
                      value={toraJustifiedRowHeightFactor}
                      onChange={(e) =>
                        setToraJustifiedRowHeightFactor(
                          Math.min(10, Math.max(5, Number(e.target.value) || 7)),
                        )
                      }
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                    <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                      /{toraJustifiedRowHeightFactor.toFixed(2)}
                    </span>
                  </div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Desktop gutter" htmlFor="tora-justified-desktop-gutter">
                    <Input
                      id="tora-justified-desktop-gutter"
                      type="number"
                      min={0}
                      max={60}
                      value={toraJustifiedDesktopGutter}
                      onChange={(e) =>
                        setToraJustifiedDesktopGutter(
                          Math.min(60, Math.max(0, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </Field>
                  <Field label="Mobile gutter" htmlFor="tora-justified-mobile-gutter">
                    <Input
                      id="tora-justified-mobile-gutter"
                      type="number"
                      min={0}
                      max={40}
                      value={toraJustifiedMobileGutter}
                      onChange={(e) =>
                        setToraJustifiedMobileGutter(
                          Math.min(40, Math.max(0, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toraJustifiedUseBackground}
                      onChange={(e) => setToraJustifiedUseBackground(e.target.checked)}
                    />
                    Use background color
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toraJustifiedHoverInset}
                      onChange={(e) => setToraJustifiedHoverInset(e.target.checked)}
                    />
                    Clip thumbnails on hover
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toraJustifiedDimOnLeadHover}
                      onChange={(e) => setToraJustifiedDimOnLeadHover(e.target.checked)}
                    />
                    Dim page on lead hover
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toraJustifiedScrollOnSelect}
                      onChange={(e) => setToraJustifiedScrollOnSelect(e.target.checked)}
                    />
                    Scroll to lead on select
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={toraJustifiedShowBlurredSideFill}
                      onChange={(e) =>
                        setToraJustifiedShowBlurredSideFill(e.target.checked)
                      }
                    />
                    Show blurred side fill
                  </label>
                </div>
              </div>
            )}
            {gridType === "palmer-draggable" && (
              <div className="space-y-3 rounded-md border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Grid density">
                    <Select
                      value={palmerDensity}
                      onChange={(e) =>
                        setPalmerDensity(
                          e.target.value as "compact" | "normal" | "wide",
                        )
                      }
                    >
                      <option value="compact">Compact</option>
                      <option value="normal">Normal</option>
                      <option value="wide">Wide</option>
                    </Select>
                  </Field>
                  <Field label="Photo size">
                    <Select
                      value={palmerItemSize}
                      onChange={(e) =>
                        setPalmerItemSize(
                          e.target.value as "small" | "medium" | "large",
                        )
                      }
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={palmerUseCustomColors}
                    onChange={(e) => setPalmerUseCustomColors(e.target.checked)}
                  />
                  Use custom colors
                </label>
                {palmerUseCustomColors && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Background color" htmlFor="palmer-bg-color">
                      <Input
                        id="palmer-bg-color"
                        type="color"
                        value={palmerBackgroundColor}
                        onChange={(e) => setPalmerBackgroundColor(e.target.value)}
                        className="h-10 p-1"
                      />
                    </Field>
                    <Field label="Text color" htmlFor="palmer-text-color">
                      <Input
                        id="palmer-text-color"
                        type="color"
                        value={palmerTextColor}
                        onChange={(e) => setPalmerTextColor(e.target.value)}
                        className="h-10 p-1"
                      />
                    </Field>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={palmerShowDetails}
                    onChange={(e) => setPalmerShowDetails(e.target.checked)}
                  />
                  Show detail panel
                </label>
              </div>
            )}
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
            draft={{
              gridType,
              spacing,
              theme,
              discourageImageSaving,
              overlay,
              altUseBackground,
              altBackgroundColor,
              altTextColor,
              altShowText,
              imgTrailVariant,
              imgTrailUseBackground,
              imgTrailBackgroundColor,
              rotatingScrollVariant: rotatingVariant,
              rotatingScrollUseBackground: rotatingUseBackground,
              rotatingScrollBackgroundColor: rotatingBackgroundColor,
              rotatingScrollMarqueeText: rotatingMarqueeText,
              diagonalUseBackground,
              diagonalBackgroundColor,
              diagonalTextColor,
              diagonalDecoColor,
              diagonalSideText,
              diagonalShowSideText,
              diagonalShowDetail,
              depthUseMoodBackground,
              depthShowTrail,
              depthShowParticles,
              depthLabelStyle,
              depthScrollSpeed,
              depthBackgroundColor,
              infiniteBackgroundColor,
              infiniteFogColor,
              infiniteDensity,
              infiniteImageSize,
              infiniteMovement,
              infiniteShowControls,
              infiniteEnableKeyboard,
              palmerDensity,
              palmerItemSize,
              palmerShowDetails,
              palmerUseCustomColors,
              palmerBackgroundColor,
              palmerTextColor,
              toraSliphoverUseBackground,
              toraSliphoverBackgroundColor,
              toraSliphoverLabelSource,
              toraSliphoverLabelBackgroundColor,
              toraSliphoverLabelTextColor,
              toraJustifiedUseBackground,
              toraJustifiedBackgroundColor,
              toraJustifiedTitleColor,
              toraJustifiedAccentColor,
              toraJustifiedTitleSource,
              toraJustifiedRowHeightFactor,
              toraJustifiedDesktopGutter,
              toraJustifiedMobileGutter,
              toraJustifiedHoverInset,
              toraJustifiedDimOnLeadHover,
              toraJustifiedScrollOnSelect,
              toraJustifiedShowBlurredSideFill,
            }}
            height={560}
          />
        </div>
      )}
    </CollapsibleCard>
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
        <EmptyState title="Gallery not found" description="It may have been deleted." />
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
