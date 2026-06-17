import { z } from "zod";

// Curated page-builder block model. Pages store an ordered `blocks` array (jsonb)
// of these shapes. Validation is defensive: unknown/garbled blocks are dropped
// rather than throwing, so a bad block never takes down a page.

export const GridEnum = z.enum(["masonry", "justified", "uniform"]);
export const SpacingEnum = z.enum(["tight", "normal", "airy"]);
export const AlignEnum = z.enum(["left", "center", "right"]);
export const EffectEnum = z.enum(["none", "webgl-distortion", "cinematic-3d-scroll"]);

const id = z.string().min(1);

// ── Leaf blocks (cannot contain children) ────────────────────────────────────
const HeadingBlock = z.object({
  id,
  type: z.literal("heading"),
  text: z.string().default(""),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  align: AlignEnum.default("left"),
});
const SubheadingBlock = z.object({
  id,
  type: z.literal("subheading"),
  text: z.string().default(""),
  align: AlignEnum.default("left"),
});
const RichTextBlock = z.object({
  id,
  type: z.literal("richtext"),
  // Plain text; blank lines split paragraphs. Rendered as text (no raw HTML).
  text: z.string().default(""),
  align: AlignEnum.default("left"),
});
const ImageBlock = z.object({
  id,
  type: z.literal("image"),
  photoId: z.string().nullable().default(null),
  caption: z.string().optional(),
  width: z.enum(["normal", "wide", "full"]).default("normal"),
  rounded: z.boolean().default(true),
});
const GalleryBlock = z.object({
  id,
  type: z.literal("gallery"),
  source: z.enum(["featured", "category", "location", "gallery"]).default("featured"),
  targetId: z.string().nullable().default(null),
  gridType: GridEnum.default("justified"),
  spacing: SpacingEnum.default("normal"),
  limit: z.number().int().min(1).max(48).default(12),
  effect: EffectEnum.default("none"),
});
// Banner has its own effect set (Ken Burns / reveal are CSS, distortion is
// WebGL). Kept separate from the gallery's EffectEnum so they don't cross over.
export const BannerEffectEnum = z.enum([
  "none",
  "ken-burns",
  "reveal",
  "webgl-distortion",
]);
export const BannerLayoutEnum = z.enum([
  "bottom-left",
  "bottom-right",
  "center",
  "split-left",
  "split-right",
]);
const BannerBlock = z.object({
  id,
  type: z.literal("banner"),
  // "photo" uses photoId; "featured" pulls the latest featured photo.
  source: z.enum(["photo", "featured"]).default("photo"),
  photoId: z.string().nullable().default(null),
  headline: z.string().default(""),
  subhead: z.string().default(""),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  height: z.enum(["short", "tall", "full"]).default("tall"),
  // Image darkening for text legibility. "auto" only darkens (bottom gradient)
  // when the banner has text; "none" never darkens; "dark" always applies a
  // stronger scrim.
  overlay: z.enum(["auto", "none", "dark"]).default("auto"),
  // Composition: where text sits, or a split image/text-panel layout.
  layout: BannerLayoutEnum.default("bottom-left"),
  // Headline typography.
  headlineFont: z.enum(["sans", "serif"]).default("sans"),
  headlineSize: z.enum(["sm", "md", "lg", "xl"]).default("lg"),
  headlineTracking: z.enum(["normal", "wide", "widest"]).default("normal"),
  headlineCase: z.enum(["normal", "upper"]).default("normal"),
  // Call-to-action button styling.
  buttonStyle: z.enum(["solid", "outline", "link", "pill"]).default("solid"),
  effect: BannerEffectEnum.default("none"),
});
const QuoteBlock = z.object({
  id,
  type: z.literal("quote"),
  text: z.string().default(""),
  cite: z.string().optional(),
});
const CtaBlock = z.object({
  id,
  type: z.literal("cta"),
  headline: z.string().default(""),
  body: z.string().optional(),
  buttonLabel: z.string().default("Get in touch"),
  buttonHref: z.string().default("/contact"),
});
const SpacerBlock = z.object({
  id,
  type: z.literal("spacer"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
});
const DividerBlock = z.object({ id, type: z.literal("divider") });
// Home-style index sections (cover grids of published categories/locations).
const CategoryIndexBlock = z.object({
  id,
  type: z.literal("categoryIndex"),
  title: z.string().default("By category"),
});
const LocationIndexBlock = z.object({
  id,
  type: z.literal("locationIndex"),
  title: z.string().default("By location"),
});
const InstagramBlock = z.object({
  id,
  type: z.literal("instagram"),
  title: z.string().default("From the field"),
  count: z.number().int().min(1).max(12).default(6),
});

export const LeafBlock = z.discriminatedUnion("type", [
  HeadingBlock,
  SubheadingBlock,
  RichTextBlock,
  ImageBlock,
  GalleryBlock,
  BannerBlock,
  QuoteBlock,
  CtaBlock,
  SpacerBlock,
  DividerBlock,
  CategoryIndexBlock,
  LocationIndexBlock,
  InstagramBlock,
]);
export type LeafBlock = z.infer<typeof LeafBlock>;

// ── Columns (one level of nesting; holds leaf blocks) ────────────────────────
const ColumnsBlock = z.object({
  id,
  type: z.literal("columns"),
  gap: SpacingEnum.default("normal"),
  columns: z.array(z.array(LeafBlock)).min(1).max(4).default([[], []]),
});

export const Block = z.union([LeafBlock, ColumnsBlock]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];

// Parse a stored blocks array defensively — drop anything that doesn't validate.
export function parseBlocks(raw: unknown): Block[] {
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const item of raw) {
    const r = Block.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

// All photoIds referenced by a block tree (image + banner blocks).
export function collectPhotoIds(blocks: Block[]): string[] {
  const ids: string[] = [];
  const visitLeaf = (b: LeafBlock) => {
    if (b.type === "image" && b.photoId) ids.push(b.photoId);
    if (b.type === "banner" && b.photoId) ids.push(b.photoId);
  };
  for (const b of blocks) {
    if (b.type === "columns") b.columns.flat().forEach(visitLeaf);
    else visitLeaf(b);
  }
  return [...new Set(ids)];
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  subheading: "Subheading",
  richtext: "Text",
  image: "Image",
  gallery: "Gallery",
  banner: "Banner",
  quote: "Quote",
  cta: "Call to action",
  spacer: "Spacer",
  divider: "Divider",
  columns: "Columns",
  categoryIndex: "Category index",
  locationIndex: "Location index",
  instagram: "Instagram feed",
};
