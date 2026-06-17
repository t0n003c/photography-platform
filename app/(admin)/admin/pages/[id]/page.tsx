"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import { BLOCK_LABELS, type Block, type BlockType, type LeafBlock } from "@/src/lib/blocks";

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

const newBlockId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `b-${Date.now()}-${Math.floor(performance.now())}`;

// Leaf block types offered in the "add" menu (columns handled separately).
const LEAF_TYPES: BlockType[] = [
  "heading", "subheading", "richtext", "image", "gallery", "banner",
  "quote", "cta", "spacer", "divider", "categoryIndex", "locationIndex",
  "instagram", "columns",
];

function makeBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "heading": return { id, type, text: "Heading", level: 2, align: "left" };
    case "subheading": return { id, type, text: "Subheading", align: "left" };
    case "richtext": return { id, type, text: "", align: "left" };
    case "image": return { id, type, photoId: null, width: "normal", rounded: true };
    case "gallery": return { id, type, source: "featured", targetId: null, gridType: "justified", spacing: "normal", limit: 12, effect: "none" };
    case "banner": return { id, type, source: "featured", photoId: null, headline: "", subhead: "", height: "tall", effect: "none" };
    case "quote": return { id, type, text: "" };
    case "cta": return { id, type, headline: "", buttonLabel: "Get in touch", buttonHref: "/contact" };
    case "spacer": return { id, type, size: "md" };
    case "divider": return { id, type };
    case "categoryIndex": return { id, type, title: "By category" };
    case "locationIndex": return { id, type, title: "By location" };
    case "instagram": return { id, type, title: "From the field", count: 6 };
    case "columns": return { id, type, gap: "normal", columns: [[], []] };
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
  const [photos, setPhotos] = useState<Opt[]>([]);
  const [targets, setTargets] = useState<Record<string, Opt[]>>({ category: [], location: [], gallery: [] });

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageRow }>(`/api/v1/admin/pages/${id}`),
      api.get<{ data: { id: string; filename: string }[] }>("/api/v1/admin/photos?limit=80").catch(() => ({ data: [] })),
      api.get<{ data: { id: string; name: string }[] }>("/api/v1/admin/categories").catch(() => ({ data: [] })),
      api.get<{ data: { id: string; name: string }[] }>("/api/v1/admin/locations").catch(() => ({ data: [] })),
      api.get<{ data: { id: string; title: string }[] }>("/api/v1/admin/galleries").catch(() => ({ data: [] })),
    ])
      .then(([p, ph, cats, locs, gals]) => {
        if (!active) return;
        setPage(p.data);
        setBlocks(Array.isArray(p.data.blocks) ? (p.data.blocks as Block[]) : []);
        setPhotos(ph.data.map((x) => ({ id: x.id, label: x.filename })));
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
  photos: Opt[];
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
  photos: Opt[];
  targets: Record<string, Opt[]>;
  onChange: (b: Block) => void;
}) {
  const setColumns = (columns: LeafBlock[][]) => onChange({ ...block, columns });
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
          onClick={() => setColumns([...block.columns, []])}
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
              <button
                type="button"
                aria-label="Remove column"
                onClick={() => setColumns(block.columns.filter((_, idx) => idx !== ci))}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {col.map((leaf, li) => (
              <div key={leaf.id} className="rounded border p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs">{BLOCK_LABELS[leaf.type]}</span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() =>
                      setColumns(block.columns.map((c, idx) => (idx === ci ? c.filter((_, k) => k !== li) : c)))
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
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
  photos: Opt[];
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
            <Select value={String(block.level)} onChange={(e) => set({ level: Number(e.target.value) as 1 | 2 | 3 })}>
              <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
            </Select>
          </Field>
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case "subheading":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Text"><Input value={block.text} onChange={(e) => set({ text: e.target.value })} /></Field>
          <AlignField value={block.align} onChange={(align) => set({ align })} />
        </div>
      );
    case "richtext":
      return (
        <div className="space-y-2">
          <Field label="Text (blank line = new paragraph)">
            <Textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <AlignField value={block.align} onChange={(align) => set({ align })} />
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
        </div>
      );
    case "image":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Photo">
            <Select value={block.photoId ?? ""} onChange={(e) => set({ photoId: e.target.value || null })}>
              <option value="">Select photo…</option>
              {photos.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </Select>
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
              <option value="masonry">Masonry</option><option value="justified">Justified</option><option value="uniform">Uniform</option>
            </Select>
          </Field>
          <Field label="Spacing">
            <Select value={block.spacing} onChange={(e) => set({ spacing: e.target.value as typeof block.spacing })}>
              <option value="tight">Tight</option><option value="normal">Normal</option><option value="airy">Airy</option>
            </Select>
          </Field>
          <Field label="Max photos">
            <Input type="number" value={block.limit} onChange={(e) => set({ limit: Number(e.target.value) })} />
          </Field>
          <Field label="Effect">
            <Select value={block.effect} onChange={(e) => set({ effect: e.target.value as typeof block.effect })}>
              <option value="none">None</option>
              <option value="cinematic-3d-scroll">Cinematic 3D scroll</option>
            </Select>
          </Field>
        </div>
      );
    case "banner":
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Image source">
            <Select value={block.source} onChange={(e) => set({ source: e.target.value as typeof block.source })}>
              <option value="featured">Latest featured</option><option value="photo">Specific photo</option>
            </Select>
          </Field>
          {block.source === "photo" && (
            <Field label="Photo">
              <Select value={block.photoId ?? ""} onChange={(e) => set({ photoId: e.target.value || null })}>
                <option value="">Select photo…</option>
                {photos.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Headline"><Input value={block.headline} onChange={(e) => set({ headline: e.target.value })} /></Field>
          <Field label="Subhead"><Input value={block.subhead} onChange={(e) => set({ subhead: e.target.value })} /></Field>
          <Field label="Button label"><Input value={block.ctaLabel ?? ""} onChange={(e) => set({ ctaLabel: e.target.value })} /></Field>
          <Field label="Button link"><Input value={block.ctaHref ?? ""} onChange={(e) => set({ ctaHref: e.target.value })} /></Field>
          <Field label="Height">
            <Select value={block.height} onChange={(e) => set({ height: e.target.value as typeof block.height })}>
              <option value="short">Short</option><option value="tall">Tall</option><option value="full">Full</option>
            </Select>
          </Field>
          <Field label="Effect">
            <Select value={block.effect} onChange={(e) => set({ effect: e.target.value as typeof block.effect })}>
              <option value="none">None</option>
              <option value="webgl-distortion">WebGL distortion</option>
            </Select>
          </Field>
        </div>
      );
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
            <a href="/admin/settings" className="underline underline-offset-2">Settings → Integrations</a>.
            Until then it falls back to your most recent library photos.
          </p>
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
      <div className="overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
        <div className="mx-auto bg-[hsl(var(--background))] transition-[max-width] duration-200" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
          <iframe key={device} src={src} title="Page preview" className="h-[720px] w-full border-0" sandbox="allow-same-origin allow-scripts allow-popups" />
        </div>
      </div>
    </div>
  );
}
