"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  "quote", "cta", "faq", "logos", "spacer", "divider", "categoryIndex", "locationIndex",
  "instagram", "columns",
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
    case "spacer": return { id, type, size: "md" };
    case "divider": return { id, type };
    case "categoryIndex": return { id, type, title: "By category" };
    case "locationIndex": return { id, type, title: "By location" };
    case "instagram": return { id, type, title: "From the field", count: 6 };
    case "faq": return { id, type, title: "Frequently asked questions", style: "accordion", align: "left", items: [{ q: "Your question?", a: "Your answer." }] };
    case "logos": return { id, type, title: "As featured in", style: "row", grayscale: true, size: "md", spacing: "normal", photoIds: [] };
    case "columns": return { id, type, gap: "normal", columns: [[], []], colAlign: ["top", "top"] };
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

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageRow }>(`/api/v1/admin/pages/${id}`),
      api.get<{ data: PhotoDTO[] }>("/api/v1/admin/photos?limit=80").catch(() => ({ data: [] as PhotoDTO[] })),
      api.get<{ data: { id: string; name: string }[] }>("/api/v1/admin/categories").catch(() => ({ data: [] })),
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
          category: cats.data.map((c) => ({ id: c.id, label: c.name })),
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold">{page.title}</h1>
          <Badge tone={page.status === "published" ? "green" : "neutral"}>{page.status}</Badge>
          {page.isHome && <Badge tone="blue">Home</Badge>}
        </div>
        <div className="flex items-center gap-2">
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Page settings</CardTitle>
            </CardHeader>
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
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between gap-2">
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
    <div className="flex items-center gap-2">
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
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left text-sm font-medium"
        >
          {BLOCK_LABELS[block.type]}
          <span className="ml-2 truncate text-xs font-normal text-[hsl(var(--muted-foreground))]">
            {blockSummary(block)}
          </span>
        </button>
        <button type="button" aria-label="Locate in preview" title="Locate in preview" onClick={() => locateInPreview(block.id)} className="p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
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
    case "columns":
      return `${block.columns.length} columns`;
    case "faq":
      return `${block.style} · ${block.items.length} questions`;
    case "logos":
      return `${block.style} · ${block.photoIds.length} logos`;
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
          <div key={ci} className="space-y-2 rounded border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Column {ci + 1}</span>
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
              <div key={leaf.id} className="rounded border p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs">{BLOCK_LABELS[leaf.type]}</span>
                  <div className="flex items-center gap-0.5 text-[hsl(var(--muted-foreground))]">
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
            <Select value={block.gridType} onChange={(e) => set({ gridType: e.target.value as typeof block.gridType })}>
              <option value="masonry">Masonry</option><option value="justified">Justified</option><option value="uniform">Uniform</option><option value="carousel">Carousel</option><option value="filmstrip">Filmstrip</option><option value="mosaic">Mosaic</option><option value="carousel3d">3D infinite carousel</option><option value="cinematic">Cinematic 3D scroll</option>
            </Select>
          </Field>
          <Field label="Spacing">
            <Select value={block.spacing} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
              <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
            </Select>
          </Field>
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
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
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
    return `/preview/page/${id}?${params.toString()}`;
  }, [id, bust, theme]);

  return (
    <div className="space-y-2 lg:sticky lg:top-4 lg:self-start">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Live preview</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant={device === "desktop" ? "default" : "outline"} size="sm" onClick={() => setDevice("desktop")} aria-label="Desktop">
            <Monitor className="h-4 w-4" />
          </Button>
          <Button type="button" variant={device === "mobile" ? "default" : "outline"} size="sm" onClick={() => setDevice("mobile")} aria-label="Mobile">
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
      <div ref={paneRef} className="overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
        {(() => {
          const baseW = device === "mobile" ? 390 : 1280;
          const visH = 640;
          const scale = paneWidth > 0 ? Math.min(1, paneWidth / baseW) : 1;
          return (
            <div className="mx-auto" style={{ width: baseW * scale, height: visH }}>
              <iframe
                ref={iframeRef}
                onLoad={handlePreviewLoad}
                id="page-preview-iframe"
                key={device}
                src={src}
                title="Page preview"
                className="border-0 bg-[hsl(var(--background))]"
                style={{
                  width: baseW,
                  height: visH / scale,
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
