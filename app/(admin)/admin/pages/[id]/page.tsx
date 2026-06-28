"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Loader2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Monitor,
  Smartphone,
  ExternalLink,
  RefreshCw,
  Crosshair,
  Settings,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import { BLOCK_LABELS, type Block, type BlockType, type LeafBlock } from "@/src/lib/blocks";
import { PhotoPicker, type PhotoOption } from "@/components/admin/photo-picker";
import { FocalPointPicker } from "@/components/admin/focal-point-picker";
import type { PhotoDTO } from "@/src/db/queries/photos";

interface PageRow {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: "draft" | "published";
  isHome: boolean;
  blocks: unknown;
  theme: "light" | "dark" | "auto" | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

interface Opt {
  id: string;
  label: string;
  photoCount?: number;
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// Scroll the live-preview iframe to a block and briefly highlight it. The iframe
// is same-origin, so we can reach into its document by the block's data-id.
function locateInPreview(blockId: string) {
  const iframe = document.getElementById("page-preview-iframe") as HTMLIFrameElement | null;
  const el = iframe?.contentDocument?.querySelector<HTMLElement>(
    `[data-block-id="${blockId}"]`,
  );
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("preview-locate");
  window.setTimeout(() => el.classList.remove("preview-locate"), 1600);
}

const newBlockId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.floor(performance.now())}`;

// Leaf block types offered in the "add" menu (columns handled separately).
const LEAF_TYPES: BlockType[] = [
  "heading", "subheading", "richtext", "image", "gallery", "banner",
  "quote", "cta", "contactForm", "faq", "logos", "spacer", "divider", "categoryIndex", "locationIndex",
  "scrollShowcase", "instagram", "columns",
];

function makeBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "heading": return { id, type, text: "Heading", level: 2, align: "left", font: "sans", spacing: "normal" };
    case "subheading": return { id, type, text: "Subheading", align: "left", font: "sans", spacing: "normal" };
    case "richtext": return { id, type, text: "", align: "left", font: "sans", size: "base" };
    case "image": return { id, type, photoId: null, width: "normal", rounded: true };
    case "gallery": return { id, type, source: "featured", targetId: null, gridType: "justified", spacing: "normal", autoplay: false, backdrop: "color", limit: 12, effect: "none", effectSpeed: 1 };
    case "banner": return { id, type, source: "featured", photoId: null, headline: "", subhead: "", height: "tall", overlay: "auto", layout: "bottom-left", focalX: 50, focalY: 50, zoom: 1, headlineFont: "sans", headlineSize: "lg", headlineTracking: "normal", headlineCase: "normal", buttonStyle: "solid", effect: "none" };
    case "quote": return { id, type, text: "" };
    case "cta": return { id, type, headline: "", buttonLabel: "Get in touch", buttonHref: "/contact", buttonStyle: "pill" };
    case "contactForm": return { id, type, style: "stacked", eyebrow: "Contact", heading: "Get in touch", body: "Tell me about your session, event, or print order and I'll be in touch soon.", submitLabel: "Send message", align: "left" };
    case "spacer": return { id, type, size: "md" };
    case "divider": return { id, type };
    case "categoryIndex": return { id, type, title: "By category" };
    case "locationIndex": return { id, type, title: "By location" };
    case "scrollShowcase": return {
      id,
      type,
      title: "",
      categoryIds: [],
      limit: 6,
      clusterCount: 4,
      showTitles: true,
      style: "cinematic",
      scrollLayoutsVariant: "row",
      scrollLayoutsPhotoCount: 9,
    };
    case "instagram": return { id, type, title: "From the field", count: 6 };
    case "faq": return { id, type, title: "Frequently asked questions", style: "accordion", align: "left", items: [{ q: "Your question?", a: "Your answer." }] };
    case "logos": return { id, type, title: "As featured in", style: "row", grayscale: true, size: "md", spacing: "normal", photoIds: [] };
    case "columns": return { id, type, gap: "normal", columns: [[], []], colAlign: ["top", "top"], justify: "fill" };
    default: return { id, type: "divider" };
  }
}

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [page, setPage] = useState<PageRow | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photos, setPhotos] = useState<PhotoOption[]>([]);
  const [targets, setTargets] = useState<Record<string, Opt[]>>({ category: [], location: [], gallery: [] });
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageRow }>(`/api/v1/admin/pages/${id}`),
      api.get<{ data: PhotoDTO[] }>("/api/v1/admin/photos?limit=80").catch(() => ({ data: [] as PhotoDTO[] })),
      api
        .get<{ data: { id: string; name: string; photoCount?: number }[] }>("/api/v1/admin/categories")
        .catch(() => ({ data: [] })),
      api.get<{ data: { id: string; name: string }[] }>("/api/v1/admin/locations").catch(() => ({ data: [] })),
      api.get<{ data: { id: string; title: string }[] }>("/api/v1/admin/galleries").catch(() => ({ data: [] })),
    ])
      .then(([p, ph, cats, locs, gals]) => {
        if (!active) return;
        setPage(p.data);
        setBlocks(Array.isArray(p.data.blocks) ? (p.data.blocks as Block[]) : []);
        setPhotos(
          ph.data.map((p) => {
            const webp = p.variants
              .filter((v) => v.format === "webp")
              .sort((a, b) => a.width - b.width);
            const thumb =
              webp.find((v) => v.sizeBucket === "thumb") ??
              webp[0] ??
              p.variants[0];
            return {
              id: p.id,
              label: p.altText || "Untitled photo",
              thumbUrl: thumb?.url ?? null,
            };
          }),
        );
        setTargets({
          category: cats.data.map((c) => ({ id: c.id, label: c.name, photoCount: c.photoCount ?? 0 })),
          location: locs.data.map((l) => ({ id: l.id, label: l.name })),
          gallery: gals.data.map((g) => ({ id: g.id, label: g.title })),
        });
      })
      .catch((err) => active && toast(errMsg(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, toast]);

  const patch = (p: Partial<PageRow>) => setPage((prev) => (prev ? { ...prev, ...p } : prev));
  const updateBlock = (i: number, b: Block) =>
    setBlocks((prev) => prev.map((x, idx) => (idx === i ? b : x)));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const removeBlock = (i: number) => setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  const addBlock = (type: BlockType) => setBlocks((prev) => [...prev, makeBlock(type)]);

  const save = async () => {
    if (!page) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/admin/pages/${id}`, {
        title: page.title,
        slug: page.slug,
        status: page.status,
        isHome: page.isHome,
        theme: page.theme,
        seoTitle: page.seoTitle,
        seoDescription: page.seoDescription,
        blocks,
      });
      toast("Saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !page) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 lg:flex lg:h-[calc(100dvh-6.5rem)] lg:flex-col lg:overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 lg:flex-none">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="min-w-0 break-words text-xl font-semibold">{page.title}</h1>
          <Badge tone={page.status === "published" ? "green" : "neutral"}>{page.status}</Badge>
          {page.isHome && <Badge tone="blue">Home</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ status: page.status === "published" ? "draft" : "published" })}
          >
            {page.status === "published" ? "Set draft" : "Mark published"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:overflow-hidden">
        {/* Editor */}
        <div className="min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="p-0">
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-[hsl(var(--muted))]/50 sm:p-5"
                aria-expanded={settingsOpen}
              >
                <CardTitle>Page settings</CardTitle>
                {settingsOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                )}
              </button>
            </CardHeader>
            {settingsOpen && (
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title">
                    <Input value={page.title} onChange={(e) => patch({ title: e.target.value })} />
                  </Field>
                  <Field label="URL slug">
                    <Input value={page.slug} onChange={(e) => patch({ slug: e.target.value })} />
                  </Field>
                  <Field label="Theme">
                    <Select
                      value={page.theme ?? "auto"}
                      onChange={(e) => patch({ theme: e.target.value as PageRow["theme"] })}
                    >
                      <option value="auto">Auto</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </Select>
                  </Field>
                  <Field label="Set as home page">
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={page.isHome}
                        onChange={(e) => patch({ isHome: e.target.checked })}
                      />
                      Render at /
                    </label>
                  </Field>
                </div>
                <Field label="SEO title">
                  <Input
                    value={page.seoTitle ?? ""}
                    onChange={(e) => patch({ seoTitle: e.target.value })}
                  />
                </Field>
                <Field label="SEO description">
                  <Textarea
                    rows={2}
                    value={page.seoDescription ?? ""}
                    onChange={(e) => patch({ seoDescription: e.target.value })}
                  />
                </Field>
              </CardContent>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Blocks</CardTitle>
              <AddBlockMenu onAdd={addBlock} />
            </CardHeader>
            <CardContent className="space-y-3">
              {blocks.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No blocks yet — add one to start building.
                </p>
              )}
              {blocks.map((block, i) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  photos={photos}
                  targets={targets}
                  onChange={(b) => updateBlock(i, b)}
                  onUp={() => moveBlock(i, -1)}
                  onDown={() => moveBlock(i, 1)}
                  onRemove={() => removeBlock(i)}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <PreviewPane id={id} blocks={blocks} theme={page.theme} slug={page.slug} />
      </div>
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <div className="min-w-0 flex-1 sm:flex-none">
      <Select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) {
            onAdd(e.target.value as BlockType);
            e.target.value = "";
          }
        }}
        className="h-8"
      >
        <option value="">+ Add block…</option>
        {LEAF_TYPES.map((t) => (
          <option key={t} value={t}>
            {BLOCK_LABELS[t]}
          </option>
        ))}
      </Select>
    </div>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-[hsl(var(--muted))]/20 p-3">
      <div className="space-y-0.5">
        <h4 className="text-sm font-semibold">{title}</h4>
        {description && (
          <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function BlockCard({
  block,
  photos,
  targets,
  onChange,
  onUp,
  onDown,
  onRemove,
}: {
  block: Block;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: Block) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = block.hidden ?? false;
  return (
    <div className={`min-w-0 rounded-lg border ${hidden ? "bg-[hsl(var(--muted))]/45 opacity-75" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-[1_1_12rem] text-left text-sm font-medium"
        >
          {BLOCK_LABELS[block.type]}
          {hidden && (
            <span className="ml-2 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Hidden
            </span>
          )}
          <span className="ml-2 truncate text-xs font-normal text-[hsl(var(--muted-foreground))]">
            {blockSummary(block)}
          </span>
        </button>
        <button
          type="button"
          aria-label={hidden ? "Show block" : "Hide block"}
          title={hidden ? "Show block" : "Hide block"}
          onClick={() => onChange({ ...block, hidden: !hidden } as Block)}
          className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        <button type="button" aria-label="Locate in preview" title="Locate in preview" disabled={hidden} onClick={() => locateInPreview(block.id)} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-30">
          <Crosshair className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Move up" onClick={onUp} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Move down" onClick={onDown} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Delete" onClick={onRemove} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="border-t p-3">
          {block.type === "columns" ? (
            <ColumnsEditor block={block} photos={photos} targets={targets} onChange={onChange} />
          ) : (
            <LeafEditor block={block} photos={photos} targets={targets} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

function blockSummary(block: Block): string {
  switch (block.type) {
    case "heading":
    case "subheading":
    case "richtext":
    case "quote":
      return block.text.slice(0, 40);
    case "gallery":
      return `${block.source} · ${block.gridType}`;
    case "banner":
      return block.headline || block.source;
    case "cta":
      return block.headline || block.buttonLabel;
    case "contactForm":
      return `${block.style} · ${block.heading || "Contact"}`;
    case "columns":
      return `${block.columns.length} columns`;
    case "faq":
      return `${block.style} · ${block.items.length} questions`;
    case "logos":
      return `${block.style} · ${block.photoIds.length} logos`;
    case "scrollShowcase":
      return `${block.style ?? "cinematic"} · up to ${block.limit} categories`;
    default:
      return "";
  }
}

function ColumnsEditor({
  block,
  photos,
  targets,
  onChange,
}: {
  block: Extract<Block, { type: "columns" }>;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: Block) => void;
}) {
  const setColumns = (columns: LeafBlock[][]) => onChange({ ...block, columns });
  // Reorder a block within its column (dir -1 = up, +1 = down).
  const moveLeaf = (ci: number, li: number, dir: -1 | 1) =>
    setColumns(
      block.columns.map((c, idx) => {
        if (idx !== ci) return c;
        const j = li + dir;
        if (j < 0 || j >= c.length) return c;
        const next = [...c];
        [next[li], next[j]] = [next[j], next[li]];
        return next;
      }),
    );
  // Per-column vertical alignment (parallel to columns; missing = "top").
  const colAlign = block.colAlign ?? [];
  const alignOf = (ci: number): "top" | "center" | "bottom" => colAlign[ci] ?? "top";
  const setAlign = (ci: number, v: "top" | "center" | "bottom") => {
    const next = [...colAlign];
    while (next.length < block.columns.length) next.push("top");
    next[ci] = v;
    onChange({ ...block, colAlign: next });
  };
  const [alignCol, setAlignCol] = useState<number | null>(null);

  // Drag-and-drop column reordering (native HTML5 DnD via a grip handle, so it
  // doesn't fight with editing the inputs inside each column). colAlign is kept
  // parallel to columns through the move.
  const [dragCol, setDragCol] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<number | null>(null);
  const moveColumn = (from: number, to: number) => {
    if (from === to || to < 0 || to >= block.columns.length) return;
    const cols = [...block.columns];
    const aligns = [...colAlign];
    while (aligns.length < block.columns.length) aligns.push("top");
    const [c] = cols.splice(from, 1);
    const [a] = aligns.splice(from, 1);
    cols.splice(to, 0, c);
    aligns.splice(to, 0, a);
    onChange({ ...block, columns: cols, colAlign: aligns });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Field label="Gap">
          <Select value={block.gap} onChange={(e) => onChange({ ...block, gap: e.target.value as typeof block.gap })}>
            <option value="tight">Tight</option>
            <option value="normal">Normal</option>
            <option value="airy">Airy</option>
          </Select>
        </Field>
        <Field label="Distribute">
          <Select value={block.justify ?? "fill"} onChange={(e) => onChange({ ...block, justify: e.target.value as typeof block.justify })}>
            <option value="fill">Fill width</option>
            <option value="center">Center</option>
            <option value="spread">Spread</option>
          </Select>
        </Field>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...block, columns: [...block.columns, []], colAlign: [...colAlign, "top"] })}
          disabled={block.columns.length >= 4}
        >
          <Plus className="h-4 w-4" /> Column
        </Button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${block.columns.length}, minmax(0,1fr))` }}>
        {block.columns.map((col, ci) => (
          <div
            key={ci}
            onDragOver={(e) => {
              if (dragCol === null) return;
              e.preventDefault();
              if (overCol !== ci) setOverCol(ci);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragCol !== null) moveColumn(dragCol, ci);
              setDragCol(null);
              setOverCol(null);
            }}
            className={`space-y-2 rounded border p-2 transition-colors ${
              dragCol === ci ? "opacity-50" : ""
            } ${overCol === ci && dragCol !== null && dragCol !== ci ? "border-[hsl(var(--ring))] bg-[hsl(var(--muted))]" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-medium">
                <button
                  type="button"
                  draggable
                  onDragStart={() => setDragCol(ci)}
                  onDragEnd={() => {
                    setDragCol(null);
                    setOverCol(null);
                  }}
                  aria-label={`Drag column ${ci + 1}`}
                  title="Drag to reorder column"
                  className="cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] active:cursor-grabbing"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </button>
                Column {ci + 1}
              </span>
              <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                <button
                  type="button"
                  aria-label="Column alignment"
                  title="Vertical alignment"
                  onClick={() => setAlignCol(alignCol === ci ? null : ci)}
                  className="hover:text-[hsl(var(--foreground))]"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Remove column"
                  onClick={() =>
                    onChange({ ...block, columns: block.columns.filter((_, idx) => idx !== ci), colAlign: colAlign.filter((_, idx) => idx !== ci) })
                  }
                  className="hover:text-[hsl(var(--foreground))]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {alignCol === ci && (
              <div className="rounded border bg-[hsl(var(--muted))] p-2">
                <Field label="Vertical align">
                  <Select value={alignOf(ci)} onChange={(e) => setAlign(ci, e.target.value as "top" | "center" | "bottom")}>
                    <option value="top">Top</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </Select>
                </Field>
              </div>
            )}
            {col.map((leaf, li) => (
              <div key={leaf.id} className={`rounded border p-2 ${leaf.hidden ? "bg-[hsl(var(--muted))]/45 opacity-75" : ""}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs">
                    {BLOCK_LABELS[leaf.type]}
                    {leaf.hidden && (
                      <span className="ml-1 rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        Hidden
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                    <button
                      type="button"
                      aria-label={leaf.hidden ? "Show block" : "Hide block"}
                      title={leaf.hidden ? "Show block" : "Hide block"}
                      onClick={() =>
                        setColumns(
                          block.columns.map((c, idx) =>
                            idx === ci
                              ? c.map((x, k) =>
                                  k === li ? ({ ...x, hidden: !(x.hidden ?? false) } as LeafBlock) : x,
                                )
                              : c,
                          ),
                        )
                      }
                      className="p-0.5 hover:text-[hsl(var(--foreground))]"
                    >
                      {leaf.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={li === 0}
                      onClick={() => moveLeaf(ci, li, -1)}
                      className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={li === col.length - 1}
                      onClick={() => moveLeaf(ci, li, 1)}
                      className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Remove"
                      onClick={() =>
                        setColumns(block.columns.map((c, idx) => (idx === ci ? c.filter((_, k) => k !== li) : c)))
                      }
                      className="p-0.5 hover:text-[hsl(var(--foreground))]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <LeafEditor
                  block={leaf}
                  photos={photos}
                  targets={targets}
                  onChange={(nb) =>
                    setColumns(block.columns.map((c, idx) => (idx === ci ? c.map((x, k) => (k === li ? (nb as LeafBlock) : x)) : c)))
                  }
                />
              </div>
            ))}
            <Select
              defaultValue=""
              className="h-8"
              onChange={(e) => {
                if (!e.target.value) return;
                const nb = makeBlock(e.target.value as BlockType) as LeafBlock;
                setColumns(block.columns.map((c, idx) => (idx === ci ? [...c, nb] : c)));
                e.target.value = "";
              }}
            >
              <option value="">+ Add…</option>
              {(["heading", "subheading", "richtext", "image", "quote"] as BlockType[]).map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeafEditor({
  block,
  photos,
  targets,
  onChange,
}: {
  block: LeafBlock;
  photos: PhotoOption[];
  targets: Record<string, Opt[]>;
  onChange: (b: LeafBlock) => void;
}) {
  const set = (patch: Partial<LeafBlock>) => onChange({ ...block, ...patch } as LeafBlock);
  switch (block.type) {
    case "heading":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Text"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <Field label="Level">
            <Select value={String(block.level)} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })}>
              <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
              <option value="4">H4</option><option value="5">H5</option><option value="6">H6</option>
            </Select>
          </Field>
          <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
          <SpacingField value={block.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} />
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case "subheading":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Text"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
          <SpacingField value={block.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} />
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case "richtext":
      return (
        <div className="space-y-2">
          <Field label="Text (blank line = new paragraph)">
            <Textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <div className="grid gap-2 sm:grid-cols-3">
            <FontField value={block.font ?? "sans"} onChange={(font) => set({ font })} />
            <Field label="Size">
              <Select value={block.size ?? "base"} onChange={(e) => set({ size: e.target.value as typeof block.size })}>
                <option value="sm">Small</option>
                <option value="base">Normal</option>
                <option value="lg">Large</option>
                <option value="xl">Extra large</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Quote"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <Field label="Attribution"><Input value={block.cite ?? ""} onChange={(e) => set({ cite: e.target.value })} /></Field>
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Headline"><Input value={block.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          <Field label="Body"><Input value={block.body ?? ""} onChange={(e) => set({ body: e.target.value })} /></Field>
          <Field label="Button label"><Input value={block.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} /></Field>
          <Field label="Button link"><Input value={block.buttonHref} onChange={(e) => set({ buttonHref: e.target.value })} /></Field>
          <Field label="Button style">
            <Select value={block.buttonStyle ?? "pill"} onChange={(e) => set({ buttonStyle: e.target.value as typeof block.buttonStyle })}>
              <option value="solid">Solid</option>
              <option value="pill">Pill</option>
              <option value="outline">Outline</option>
              <option value="soft">Soft</option>
              <option value="link">Text link</option>
            </Select>
          </Field>
        </div>
      );
    case "contactForm":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Form style">
              <Select value={block.style} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                <option value="stacked">Stacked intro</option>
                <option value="split">Split intro + form</option>
                <option value="card">Card form</option>
                <option value="minimal">Minimal</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
            <Field label="Top label">
              <Input value={block.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Heading">
              <Input value={block.heading} onChange={(e) => set({ heading: e.target.value })} />
            </Field>
            <Field label="Submit button">
              <Input value={block.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} />
            </Field>
          </div>
          <Field label="Intro text">
            <Textarea rows={3} value={block.body} onChange={(e) => set({ body: e.target.value })} />
          </Field>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Messages submit to the existing contact inbox. Manage received messages in{" "}
            <Link href="/admin/contact" className="underline underline-offset-2">Inbox</Link>.
          </p>
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Photo">
            <PhotoPicker photos={photos} value={block.photoId ?? null} onChange={(pid) => set({ photoId: pid })} />
          </Field>
          <Field label="Width">
            <Select value={block.width} onChange={(e) => set({ width: e.target.value as typeof block.width })}>
              <option value="normal">Normal</option><option value="wide">Wide</option><option value="full">Full</option>
            </Select>
          </Field>
          <Field label="Caption"><Input value={block.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} /></Field>
        </div>
      );
    case "gallery":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Source">
            <Select value={block.source} onChange={(e) => set({ source: e.target.value as typeof block.source, targetId: null })}>
              <option value="featured">Featured</option><option value="category">Category</option>
              <option value="location">Location</option><option value="gallery">Gallery</option>
            </Select>
          </Field>
          {block.source !== "featured" && (
            <Field label="Target">
              <Select value={block.targetId ?? ""} onChange={(e) => set({ targetId: e.target.value || null })}>
                <option value="">Select…</option>
                {(targets[block.source] ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Grid">
            <Select
              value={block.gridType}
              onChange={(e) => {
                const gridType = e.target.value as typeof block.gridType;
                set({
                  gridType,
                  effect: "none",
                });
              }}
            >
              <option value="masonry">Masonry</option><option value="justified">Justified</option><option value="uniform">Uniform</option><option value="carousel">Carousel</option><option value="filmstrip">Filmstrip</option><option value="mosaic">Mosaic</option><option value="carousel3d">3D infinite carousel</option><option value="horizontal-lenis">Horizontal scroll</option><option value="cinematic">Cinematic 3D scroll</option>
            </Select>
          </Field>
          {/* The 3D infinite carousel and cinematic 3D scroll manage their own
              layout, so the tight/normal/airy spacing control doesn't apply. */}
          {block.gridType !== "carousel3d" && block.gridType !== "cinematic" && (
            <Field label="Spacing">
              <Select value={block.spacing} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
                <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
              </Select>
            </Field>
          )}
          {block.gridType === "carousel3d" && (
            <Field label="Backdrop">
              <Select value={block.backdrop ?? "color"} onChange={(e) => set({ backdrop: e.target.value as typeof block.backdrop })}>
                <option value="color">Color (from photo)</option>
                <option value="neutral">Neutral (no color)</option>
              </Select>
            </Field>
          )}
          {block.gridType === "carousel" && (
            <Field label="Auto-roll">
              <label className="flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={block.autoplay ?? false}
                  onChange={(e) => set({ autoplay: e.target.checked })}
                />
                Advance slides automatically
              </label>
            </Field>
          )}
          <Field label="Max photos">
            <Input type="number" value={block.limit} onChange={(e) => set({ limit: Number(e.target.value) })} />
          </Field>
          {block.gridType === "cinematic" && (
            <Field label="Scroll speed">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.2}
                  max={2}
                  step={0.05}
                  value={block.effectSpeed ?? 1}
                  onChange={(e) => set({ effectSpeed: Number(e.target.value) })}
                  className="w-full accent-[hsl(var(--primary))]"
                />
                <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
                  {(block.effectSpeed ?? 1).toFixed(1)}×
                </span>
              </div>
            </Field>
          )}
        </div>
      );
    case "banner": {
      // Source / darken / layout trio (top-left in both source modes).
      const cfg = (
        <>
          <Field label="Image source">
            <Select value={block.source} onChange={(e) => set({ source: e.target.value as typeof block.source })}>
              <option value="featured">Latest featured</option><option value="photo">Specific photo</option>
            </Select>
          </Field>
          <Field label="Darken image">
            <Select value={block.overlay ?? "auto"} onChange={(e) => set({ overlay: e.target.value as typeof block.overlay })}>
              <option value="auto">Auto (only behind text)</option>
              <option value="none">None</option>
              <option value="dark">Always darken</option>
            </Select>
          </Field>
          <Field label="Layout">
            <Select value={block.layout ?? "bottom-left"} onChange={(e) => set({ layout: e.target.value as typeof block.layout })}>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="center">Centered</option>
              <option value="split-left">Split · image left</option>
              <option value="split-right">Split · image right</option>
              <option value="split-top">Split · image top</option>
              <option value="split-bottom">Split · image bottom</option>
            </Select>
          </Field>
        </>
      );
      const focalField = (
        <Field label="Image position">
          <FocalPointPicker
            x={block.focalX ?? 50}
            y={block.focalY ?? 50}
            thumbUrl={photos.find((p) => p.id === block.photoId)?.thumbUrl ?? null}
            onChange={(fx, fy) => set({ focalX: fx, focalY: fy })}
          />
        </Field>
      );
      const zoomField = (
        <Field label="Zoom">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={block.zoom ?? 1}
              onChange={(e) => set({ zoom: Number(e.target.value) })}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <span className="w-10 text-right text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {Math.round((block.zoom ?? 1) * 100)}%
            </span>
          </div>
        </Field>
      );
      const rest = (
        <>
          <Field label="Headline"><Input value={block.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          <Field label="Subhead"><Input value={block.subhead} onChange={(e) => set({ subhead: e.target.value })} /></Field>
          <Field label="Headline font">
            <Select value={block.headlineFont ?? "sans"} onChange={(e) => set({ headlineFont: e.target.value as typeof block.headlineFont })}>
              <option value="sans">Sans</option><option value="serif">Serif</option>
            </Select>
          </Field>
          <Field label="Headline size">
            <Select value={block.headlineSize ?? "lg"} onChange={(e) => set({ headlineSize: e.target.value as typeof block.headlineSize })}>
              <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option><option value="xl">Extra large</option>
            </Select>
          </Field>
          <Field label="Letter spacing">
            <Select value={block.headlineTracking ?? "normal"} onChange={(e) => set({ headlineTracking: e.target.value as typeof block.headlineTracking })}>
              <option value="normal">Normal</option><option value="wide">Wide</option><option value="widest">Widest</option>
            </Select>
          </Field>
          <Field label="Headline case">
            <Select value={block.headlineCase ?? "normal"} onChange={(e) => set({ headlineCase: e.target.value as typeof block.headlineCase })}>
              <option value="normal">As typed</option><option value="upper">UPPERCASE</option>
            </Select>
          </Field>
          <Field label="Button label"><Input value={block.ctaLabel ?? ""} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
          <Field label="Button link"><Input value={block.ctaHref ?? ""} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
          <Field label="Button style">
            <Select value={block.buttonStyle ?? "solid"} onChange={(e) => set({ buttonStyle: e.target.value as typeof block.buttonStyle })}>
              <option value="solid">Solid</option><option value="pill">Pill</option><option value="outline">Outline</option><option value="link">Text link</option>
            </Select>
          </Field>
          <Field label="Height">
            <Select value={block.height} onChange={(e) => set({ height: e.target.value as typeof block.height })}>
              <option value="short">Short</option><option value="tall">Tall</option><option value="full">Full</option>
            </Select>
          </Field>
          <Field label="Effect">
            <Select value={block.effect} onChange={(e) => set({ effect: e.target.value as typeof block.effect })}>
              <option value="none">None</option>
              <option value="ken-burns">Ken Burns (slow zoom)</option>
              <option value="reveal">Load reveal</option>
              <option value="webgl-distortion">WebGL distortion</option>
            </Select>
          </Field>
        </>
      );
      // Featured: no photo picker, so put the (tall) Image position beside the
      // source/darken/layout trio, then flow zoom + text below.
      if (block.source === "featured") {
        return (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">{cfg}</div>
              {focalField}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {zoomField}
              {rest}
            </div>
          </div>
        );
      }
      // Specific photo: trio + Image position on the left; the Photo picker fills
      // the right column so its bottom lines up with the Image position bottom.
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              {cfg}
              {focalField}
            </div>
            <div className="flex h-full flex-col gap-1.5">
              <Label>Photo</Label>
              <PhotoPicker
                photos={photos}
                value={block.photoId ?? null}
                onChange={(pid) => set({ photoId: pid })}
                containerClassName="min-h-0 flex-1"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {zoomField}
            {rest}
          </div>
        </div>
      );
    }
    case "spacer":
      return (
        <Field label="Size">
          <Select value={block.size} onChange={(e) => set({ size: e.target.value as typeof block.size })}>
            <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
          </Select>
        </Field>
      );
    case "categoryIndex":
    case "locationIndex":
      return <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>;
    case "scrollShowcase": {
      const cats = targets.category ?? [];
      // Blocks created before categoryIds existed (or via raw inserts) won't have
      // it — the editor loads stored blocks without applying schema defaults.
      const chosen = block.categoryIds ?? [];
      const unchosen = cats.filter((c) => !chosen.includes(c.id));
      const labelOf = (cid: string) => cats.find((c) => c.id === cid)?.label ?? "(removed)";
      const photoCountOf = (cid: string) => cats.find((c) => c.id === cid)?.photoCount ?? 0;
      const categoryOptionLabel = (c: Opt) =>
        `${c.label} (${c.photoCount ?? 0} ${(c.photoCount ?? 0) === 1 ? "photo" : "photos"})`;
      const auto = chosen.length === 0;
      const isScrollPanels = block.style === "scrollPanels";
      const isLayoutFormations = block.style === "layoutFormations";
      const isScrollLayouts = block.style === "scrollLayouts";
      const useScrollPanelsBackground = block.scrollPanelsUseBackground ?? true;
      const useScrollLayoutsBackground = block.scrollLayoutsUseBackground ?? true;
      const layoutFormationVariant = block.layoutFormationsVariant ?? "rise";
      const layoutFormationPhotoOptions =
        layoutFormationVariant === "zoomed" ? [9] : [6, 9, 12, 18, 24];
      const storedLayoutFormationPhotoCount =
        block.layoutFormationsPhotoCount === 17
          ? 18
          : (block.layoutFormationsPhotoCount ?? 12);
      const layoutFormationPhotoCount =
        layoutFormationVariant === "zoomed"
          ? 9
          : storedLayoutFormationPhotoCount;
      const scrollLayoutsVariant = block.scrollLayoutsVariant ?? "row";
      const scrollLayoutsFixedCounts: Record<string, number> = {
        row: 7,
        breakout: 9,
        grid10: 16,
        stackDark: 6,
        stackGlass: 6,
        stackScale: 6,
        bento: 8,
        single: 1,
      };
      const scrollLayoutsPhotoOptions =
        scrollLayoutsVariant === "tiny"
          ? [24, 36, 60, 80]
          : [scrollLayoutsFixedCounts[scrollLayoutsVariant] ?? 9];
      const scrollLayoutsPhotoCount =
        scrollLayoutsVariant === "tiny"
          ? (block.scrollLayoutsPhotoCount ?? 80)
          : scrollLayoutsPhotoOptions[0];
      return (
        <div className="space-y-3">
          <SettingsGroup
            title="Style"
            description="Choose the animation family first. The controls below change to match that style."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Showcase style">
                <Select value={block.style ?? "cinematic"} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                  <option value="cinematic">Cinematic wipe</option>
                  <option value="carousel3d">3D carousel (on scroll)</option>
                  <option value="scrollPanels">Scroll panels</option>
                  <option value="layoutFormations">Layout formations</option>
                  <option value="scrollLayouts">Scroll layout morphs</option>
                </Select>
              </Field>
              <Field label="Category title display">
                <Select value={block.showTitles ? "yes" : "no"} onChange={(e) => set({ showTitles: e.target.value === "yes" })}>
                  <option value="yes">Show category names</option>
                  <option value="no">Hide category names</option>
                </Select>
              </Field>
              {auto && (
                <Field label="Max categories">
                  <Select value={String(block.limit)} onChange={(e) => set({ limit: Number(e.target.value) })}>
                    {[3, 4, 5, 6, 8, 10, 12].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
              )}
            </div>
          </SettingsGroup>

          {isScrollPanels ? (
            <>
              <SettingsGroup
                title="Intro text"
                description="Text shown before the collection rows rise over the intro photos."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Top label">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Text position">
                    <Select
                      value={block.scrollPanelsIntroAlign ?? "left"}
                      onChange={(e) => set({ scrollPanelsIntroAlign: e.target.value as typeof block.scrollPanelsIntroAlign })}
                    >
                      <option value="left">Left side</option>
                      <option value="center">Middle</option>
                      <option value="right">Right side</option>
                    </Select>
                  </Field>
                  <Field label="Main heading">
                    <Textarea
                      rows={2}
                      value={block.scrollPanelsIntroHeading ?? "Selected Stories"}
                      onChange={(e) => set({ scrollPanelsIntroHeading: e.target.value })}
                    />
                  </Field>
                  <Field label="Supporting text">
                    <Textarea
                      rows={3}
                      value={
                        block.scrollPanelsIntroText ??
                        "Scroll through featured collections, places, and small visual fragments from the archive."
                      }
                      onChange={(e) => set({ scrollPanelsIntroText: e.target.value })}
                    />
                  </Field>
                  <Field label="Collection heading">
                    <Textarea
                      rows={2}
                      value={block.scrollPanelsShowcaseHeading ?? "Selected Work"}
                      onChange={(e) => set({ scrollPanelsShowcaseHeading: e.target.value })}
                    />
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Scroll panels layout"
                description="Controls the intro photo treatment and the category rows below it."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Demo variant">
                    <Select
                      value={
                        block.scrollPanelsVariant === "zoom" || block.scrollPanelsVariant === "brightness"
                          ? "demo4"
                          : block.scrollPanelsVariant ?? "classic"
                      }
                      onChange={(e) => set({ scrollPanelsVariant: e.target.value as typeof block.scrollPanelsVariant })}
                    >
                      <option value="classic">Classic columns</option>
                      <option value="scatter">Scatter outward</option>
                      <option value="demo4">Angled rows</option>
                      <option value="perspective">Perspective blur</option>
                    </Select>
                  </Field>
                  <Field label="Intro photo count">
                    <Select
                      value={String(block.scrollPanelsIntroCount ?? 12)}
                      onChange={(e) => set({ scrollPanelsIntroCount: Number(e.target.value) })}
                    >
                      {[6, 9, 12, 15, 18, 21, 24].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                  <Field label="Photos per collection row">
                    <Select
                      value={String(block.scrollPanelsRowCount ?? 5)}
                      onChange={(e) => set({ scrollPanelsRowCount: Number(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </Field>
                  <Field label="Photo tone">
                    <Select
                      value={block.scrollPanelsTone ?? "color"}
                      onChange={(e) => set({ scrollPanelsTone: e.target.value as typeof block.scrollPanelsTone })}
                    >
                      <option value="color">Full color</option>
                      <option value="grayscale">Reveal from black and white</option>
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Colors"
                description="Use custom colors for this block, or let the page theme decide."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Background mode">
                    <Select
                      value={useScrollPanelsBackground ? "yes" : "no"}
                      onChange={(e) => set({ scrollPanelsUseBackground: e.target.value === "yes" })}
                    >
                      <option value="yes">Use custom background</option>
                      <option value="no">Use page background</option>
                    </Select>
                  </Field>
                  {useScrollPanelsBackground && (
                    <>
                      <Field label="Background color">
                        <Input
                          type="color"
                          value={block.scrollPanelsBackground ?? "#f4f0e8"}
                          onChange={(e) => set({ scrollPanelsBackground: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                      <Field label="Text color">
                        <Input
                          type="color"
                          value={block.scrollPanelsTextColor ?? "#171717"}
                          onChange={(e) => set({ scrollPanelsTextColor: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </SettingsGroup>
            </>
          ) : isLayoutFormations ? (
            <>
              <SettingsGroup
                title="Top text"
                description="Text shown above the first animated formation grid."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Eyebrow">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Top heading">
                    <Input
                      value={block.layoutFormationsHeading ?? "Layout formations"}
                      onChange={(e) => set({ layoutFormationsHeading: e.target.value })}
                      placeholder="Layout formations"
                    />
                  </Field>
                  <Field label="Text position">
                    <Select
                      value={block.layoutFormationsHeaderAlign ?? "left"}
                      onChange={(e) =>
                        set({
                          layoutFormationsHeaderAlign:
                            e.target.value as typeof block.layoutFormationsHeaderAlign,
                        })
                      }
                    >
                      <option value="left">Left side</option>
                      <option value="center">Center</option>
                      <option value="right">Right side</option>
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Formation layout"
                description="Choose the animation pattern and how many photos each category formation uses."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Formation variant">
                    <Select
                      value={layoutFormationVariant}
                      onChange={(e) => {
                        const nextVariant =
                          e.target.value as typeof block.layoutFormationsVariant;
                        set({
                          layoutFormationsVariant: nextVariant,
                          ...(nextVariant === "zoomed"
                            ? { layoutFormationsPhotoCount: 9 }
                            : {}),
                        });
                      }}
                    >
                      <option value="rise">Rise grid</option>
                      <option value="columns">Column assemble</option>
                      <option value="zoomed">Zoomed grid</option>
                      <option value="reveal">Column reveal</option>
                      <option value="tilted">Tilted fly-in</option>
                      <option value="depth">3D depth fly-in</option>
                      <option value="sidePivot">Side pivot</option>
                    </Select>
                  </Field>
                  <Field label="Photos per formation">
                    <Select
                      value={String(layoutFormationPhotoCount)}
                      onChange={(e) =>
                        set({ layoutFormationsPhotoCount: Number(e.target.value) })
                      }
                    >
                      {layoutFormationPhotoOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </SettingsGroup>
            </>
          ) : isScrollLayouts ? (
            <>
              <SettingsGroup
                title="Layout morph"
                description="Codrops ScrollBasedLayoutAnimations-style pinned image layout transitions."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Demo variant">
                    <Select
                      value={scrollLayoutsVariant}
                      onChange={(e) => {
                        const nextVariant = e.target.value as typeof block.scrollLayoutsVariant;
                        const fixedCounts: Record<string, number> = {
                          row: 7,
                          breakout: 9,
                          grid10: 16,
                          stackDark: 6,
                          stackGlass: 6,
                          stackScale: 6,
                          bento: 8,
                          single: 1,
                        };
                        set({
                          scrollLayoutsVariant: nextVariant,
                          scrollLayoutsPhotoCount:
                            nextVariant === "tiny" ? 80 : fixedCounts[nextVariant ?? "row"] ?? 9,
                        });
                      }}
                    >
                      <option value="row">Row focus</option>
                      <option value="breakout">Breakout grid</option>
                      <option value="grid10">Long grid</option>
                      <option value="stackDark">Dark stack</option>
                      <option value="stackGlass">Glass stack</option>
                      <option value="stackScale">Scale stack</option>
                      <option value="tiny">Tiny grid</option>
                      <option value="bento">Bento spread</option>
                      <option value="single">Single image reveal</option>
                    </Select>
                  </Field>
                  <Field label="Photos per layout">
                    <Select
                      value={String(scrollLayoutsPhotoCount)}
                      onChange={(e) => set({ scrollLayoutsPhotoCount: Number(e.target.value) })}
                    >
                      {scrollLayoutsPhotoOptions.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Top label">
                    <Input
                      value={block.title}
                      onChange={(e) => set({ title: e.target.value })}
                      placeholder="Selected work"
                    />
                  </Field>
                  <Field label="Caption">
                    <Textarea
                      rows={3}
                      value={block.scrollLayoutsCaption ?? ""}
                      onChange={(e) => set({ scrollLayoutsCaption: e.target.value })}
                      placeholder="Leave blank to use the category name."
                    />
                  </Field>
                </div>
              </SettingsGroup>

              <SettingsGroup
                title="Colors"
                description="Use the dark Codrops-style background or let the page theme decide."
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Background mode">
                    <Select
                      value={useScrollLayoutsBackground ? "yes" : "no"}
                      onChange={(e) => set({ scrollLayoutsUseBackground: e.target.value === "yes" })}
                    >
                      <option value="yes">Use custom background</option>
                      <option value="no">Use page background</option>
                    </Select>
                  </Field>
                  {useScrollLayoutsBackground && (
                    <>
                      <Field label="Background color">
                        <Input
                          type="color"
                          value={block.scrollLayoutsBackground ?? "#131417"}
                          onChange={(e) => set({ scrollLayoutsBackground: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                      <Field label="Text color">
                        <Input
                          type="color"
                          value={block.scrollLayoutsTextColor ?? "#ffffff"}
                          onChange={(e) => set({ scrollLayoutsTextColor: e.target.value })}
                          className="h-10 p-1"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </SettingsGroup>
            </>
          ) : (
            <SettingsGroup
              title={block.style === "carousel3d" ? "3D carousel content" : "Cinematic panel content"}
              description="These styles use each category as a scroll-driven panel."
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Eyebrow">
                  <Input
                    value={block.title}
                    onChange={(e) => set({ title: e.target.value })}
                    placeholder="Selected work"
                  />
                </Field>
                <Field label="Images per panel">
                  <Select value={String(block.clusterCount)} onChange={(e) => set({ clusterCount: Number(e.target.value) })}>
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                  </Select>
                </Field>
              </div>
            </SettingsGroup>
          )}

          <SettingsGroup
            title="Categories"
            description="Choose the categories and order used by this showcase. Empty means automatic."
          >
            <Field label="Categories to show">
              <div className="space-y-1.5">
                {chosen.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Showing all published categories automatically, up to the max category count.
                  </p>
                ) : (
                  chosen.map((cid, i) => (
                    <div key={cid} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                      <span className="truncate text-sm">
                        {i + 1}. {labelOf(cid)}
                        <span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">
                          ({photoCountOf(cid)} {photoCountOf(cid) === 1 ? "photo" : "photos"})
                        </span>
                      </span>
                      <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                        <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => set({ categoryIds: swapAt(chosen, i, i - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => set({ categoryIds: swapAt(chosen, i, i + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Remove" onClick={() => set({ categoryIds: chosen.filter((x) => x !== cid) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))
                )}
                {unchosen.length > 0 && (
                  <Select value="" onChange={(e) => e.target.value && set({ categoryIds: [...chosen, e.target.value] })}>
                    <option value="">＋ Add category…</option>
                    {unchosen.map((c) => <option key={c.id} value={c.id}>{categoryOptionLabel(c)}</option>)}
                  </Select>
                )}
              </div>
            </Field>
          </SettingsGroup>

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Each category becomes a full-screen panel or formation using its photos and name. Categories with no photos are skipped. Manage covers + which categories are published in{" "}
            <Link href="/admin/categories" className="underline underline-offset-2">Categories</Link>.
          </p>
        </div>
      );
    }
    case "instagram":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Title"><Input value={block.title} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Count"><Input type="number" value={block.count} onChange={(e) => set({ count: Number(e.target.value) })} /></Field>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Shows your Instagram feed once connected in{" "}
            <Link href="/admin/settings" className="underline underline-offset-2">Settings → Integrations</Link>.
            Until then it falls back to your most recent library photos.
          </p>
        </div>
      );
    case "faq":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Title (optional)"><Input value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Style">
              <Select value={block.style} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                <option value="accordion">Accordion</option>
                <option value="list">List</option>
                <option value="cards">Cards</option>
                <option value="bordered">Bordered</option>
              </Select>
            </Field>
            <AlignField value={block.align} onChange={(align) => set({ align })} />
          </div>
          <div className="space-y-2">
            {block.items.map((it, i) => (
              <div key={i} className="space-y-1.5 rounded border p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Q{i + 1}</span>
                  <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => set({ items: swapAt(block.items, i, i - 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Move down" disabled={i === block.items.length - 1} onClick={() => set({ items: swapAt(block.items, i, i + 1) })} className="p-0.5 hover:text-[hsl(var(--foreground))] disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label="Remove" onClick={() => set({ items: block.items.filter((_, k) => k !== i) })} className="p-0.5 hover:text-[hsl(var(--foreground))]"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
                <Input placeholder="Question" value={it.q} onChange={(e) => set({ items: block.items.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                <Textarea rows={2} placeholder="Answer" value={it.a} onChange={(e) => set({ items: block.items.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => set({ items: [...block.items, { q: "", a: "" }] })}>
              <Plus className="h-4 w-4" /> Question
            </Button>
          </div>
        </div>
      );
    case "logos":
      return (
        <div className="space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Title (optional)"><Input value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label="Style">
              <Select value={block.style} onChange={(e) => set({ style: e.target.value as typeof block.style })}>
                <option value="row">Row</option>
                <option value="grid">Grid</option>
                <option value="marquee">Marquee (scrolling)</option>
              </Select>
            </Field>
            <Field label="Size">
              <Select value={block.size} onChange={(e) => set({ size: e.target.value as typeof block.size })}>
                <option value="sm">Small</option><option value="md">Medium</option><option value="lg">Large</option>
              </Select>
            </Field>
            <Field label="Spacing">
              <Select value={block.spacing ?? "normal"} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
                <option value="tighter">Tighter</option><option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
              </Select>
            </Field>
            <Field label="Color">
              <Select value={block.grayscale ? "mono" : "color"} onChange={(e) => set({ grayscale: e.target.value === "mono" })}>
                <option value="mono">Grayscale (color on hover)</option>
                <option value="color">Full color</option>
              </Select>
            </Field>
          </div>
          <Field label="Logos — click to add/remove (from your library)">
            <PhotoPicker
              photos={photos}
              selectedIds={block.photoIds}
              onToggle={(pid) => set({ photoIds: block.photoIds.includes(pid) ? block.photoIds.filter((x) => x !== pid) : [...block.photoIds, pid] })}
            />
          </Field>
        </div>
      );
    case "divider":
      return <p className="text-xs text-[hsl(var(--muted-foreground))]">A horizontal rule. No settings.</p>;
    default:
      return null;
  }
}

function AlignField({ value, onChange }: { value: "left" | "center" | "right"; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <Field label="Align">
      <Select value={value} onChange={(e) => onChange(e.target.value as "left" | "center" | "right")}>
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </Select>
    </Field>
  );
}

type FontValue = "sans" | "serif" | "playfair" | "cormorant" | "montserrat" | "grotesk";
function FontField({ value, onChange }: { value: FontValue; onChange: (v: FontValue) => void }) {
  return (
    <Field label="Font">
      <Select value={value} onChange={(e) => onChange(e.target.value as FontValue)}>
        <option value="sans">Sans</option>
        <option value="serif">Serif</option>
        <option value="playfair">Playfair Display</option>
        <option value="cormorant">Cormorant</option>
        <option value="montserrat">Montserrat</option>
        <option value="grotesk">Space Grotesk</option>
      </Select>
    </Field>
  );
}

type SpaceValue = "tight" | "normal" | "airy";
function SpacingField({ value, onChange }: { value: SpaceValue; onChange: (v: SpaceValue) => void }) {
  return (
    <Field label="Spacing">
      <Select value={value} onChange={(e) => onChange(e.target.value as SpaceValue)}>
        <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
      </Select>
    </Field>
  );
}

function PreviewPane({
  id,
  blocks,
  theme,
  slug,
}: {
  id: string;
  blocks: Block[];
  theme: "light" | "dark" | "auto" | null;
  slug: string;
}) {
  const { toast } = useToast();
  const [device, setDevice] = useState<"desktop" | "mobile">(() => {
    if (typeof window === "undefined") return "desktop";
    return window.matchMedia("(max-width: 767px)").matches
      ? "mobile"
      : "desktop";
  });
  const [manualDevice, setManualDevice] = useState(false);
  const [bust, setBust] = useState(0);

  // Preserve the preview's scroll position across reloads (each draft push busts
  // the iframe src). Track scroll into a ref; restore it once the new doc loads.
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef(0);
  const onPreviewScroll = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win) scrollRef.current = win.scrollY;
  }, []);
  const handlePreviewLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.scrollTo(0, scrollRef.current);
    win.removeEventListener("scroll", onPreviewScroll);
    win.addEventListener("scroll", onPreviewScroll, { passive: true });
  }, [onPreviewScroll]);

  // Measure the available pane width so the desktop preview can render at a real
  // desktop width (so md: breakpoints apply — columns sit side by side) and be
  // scaled to fit, instead of rendering narrow (where everything stacks).
  const paneRef = useRef<HTMLDivElement>(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => setPaneWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (manualDevice) return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setDevice(mq.matches ? "mobile" : "desktop");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [manualDevice]);

  const pushDraft = useCallback(async () => {
    try {
      await api.post(`/api/v1/admin/pages/${id}/preview`, { blocks, theme });
      setBust((n) => n + 1);
    } catch (err) {
      toast(errMsg(err), "error");
    }
  }, [id, blocks, theme, toast]);

  // Debounced: push the draft + refresh whenever blocks/theme change.
  useEffect(() => {
    const t = setTimeout(() => {
      void pushDraft();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, theme]);

  const src = useMemo(() => {
    const params = new URLSearchParams();
    params.set("v", String(bust));
    if (theme === "light" || theme === "dark") params.set("__theme", theme);
    params.set("__previewFrame", "1");
    return `/preview/page/${id}?${params.toString()}`;
  }, [id, bust, theme]);

  return (
    <div className="min-w-0 space-y-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Live preview</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            variant={device === "desktop" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setManualDevice(true);
              setDevice("desktop");
            }}
            aria-label="Desktop"
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
            aria-label="Mobile"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={pushDraft} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <a href={`/${slug}`} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center rounded-md border px-2 text-xs">
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
          </a>
        </div>
      </div>
      <div ref={paneRef} className="min-w-0 overflow-hidden rounded-lg border bg-[hsl(var(--muted))] lg:flex-none">
        {(() => {
          const baseW = device === "mobile" ? 390 : 1440;
          const baseH = device === "mobile" ? 844 : 900;
          const scale = paneWidth > 0 ? Math.min(1, paneWidth / baseW) : 1;
          const visH = device === "mobile" ? baseH * scale : Math.min(640, baseH * scale);
          return (
            <div className="mx-auto" style={{ width: baseW * scale, height: visH }}>
              <iframe
                ref={iframeRef}
                onLoad={handlePreviewLoad}
                id="page-preview-iframe"
                key={`${device}-${bust}`}
                src={src}
                title="Page preview"
                className="border-0 bg-[hsl(var(--background))]"
                style={{
                  width: baseW,
                  height: baseH,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
                sandbox="allow-same-origin allow-scripts allow-popups"
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
