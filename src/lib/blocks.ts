import { z } from "zod";

// Curated page-builder block model. Pages store an ordered `blocks` array (jsonb)
// of these shapes. Validation is defensive: unknown/garbled blocks are dropped
// rather than throwing, so a bad block never takes down a page.

export const GridEnum = z.enum([
  "masonry",
  "justified",
  "uniform",
  "carousel",
  "filmstrip",
  "mosaic",
  "carousel3d",
  "cinematic",
  "horizontal-lenis",
]);
export const SpacingEnum = z.enum(["tight", "normal", "airy"]);
export const AlignEnum = z.enum(["left", "center", "right"]);
export const EffectEnum = z.enum(["none", "webgl-distortion", "cinematic-3d-scroll"]);
// Font choices for heading/subheading text. "sans"/"serif" are the system
// stacks; the rest are self-hosted Google fonts loaded via next/font (layout.tsx)
// and exposed as CSS classes (globals.css).
export const FontEnum = z.enum([
  "sans",
  "serif",
  "playfair",
  "cormorant",
  "montserrat",
  "grotesk",
]);

const id = z.string().min(1);
const baseBlock = {
  id,
  hidden: z.boolean().default(false).optional(),
};

// ── Leaf blocks (cannot contain children) ────────────────────────────────────
const HeadingBlock = z.object({
  ...baseBlock,
  type: z.literal("heading"),
  text: z.string().default(""),
  level: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ])
    .default(2),
  align: AlignEnum.default("left"),
  font: FontEnum.default("sans"),
  // Vertical space around the block (overrides the default block rhythm) — lets
  // a heading sit tight against a following subheading.
  spacing: SpacingEnum.default("normal"),
});
const SubheadingBlock = z.object({
  ...baseBlock,
  type: z.literal("subheading"),
  text: z.string().default(""),
  align: AlignEnum.default("left"),
  font: FontEnum.default("sans"),
  spacing: SpacingEnum.default("normal"),
});
export const TextSizeEnum = z.enum(["sm", "base", "lg", "xl"]);
const RichTextBlock = z.object({
  ...baseBlock,
  type: z.literal("richtext"),
  // Plain text; blank lines split paragraphs. Rendered as text (no raw HTML).
  text: z.string().default(""),
  align: AlignEnum.default("left"),
  font: FontEnum.default("sans"),
  size: TextSizeEnum.default("base"),
});
const ImageBlock = z.object({
  ...baseBlock,
  type: z.literal("image"),
  photoId: z.string().nullable().default(null),
  caption: z.string().optional(),
  width: z.enum(["normal", "wide", "full"]).default("normal"),
  rounded: z.boolean().default(true),
});
const GallerySortEnum = z.enum([
  "source",
  "newest",
  "oldest",
  "title-asc",
  "title-desc",
  "custom",
]);
const GalleryFilterSort = z.object({
  key: z.string().min(1),
  sortMode: GallerySortEnum.default("source"),
  photoIds: z.array(z.string()).default([]),
});
const GalleryBlock = z.object({
  ...baseBlock,
  type: z.literal("gallery"),
  source: z.enum(["featured", "category", "location", "gallery"]).default("featured"),
  targetId: z.string().nullable().default(null),
  gridType: GridEnum.default("justified"),
  spacing: SpacingEnum.default("normal"),
  // Carousel only: auto-advance through the slides (pauses on hover/interaction).
  autoplay: z.boolean().default(false),
  // 3D infinite carousel only: "color" tints the gradient backdrop from the
  // active photo; "neutral" keeps the gradient shade but with no color.
  backdrop: z.enum(["color", "neutral"]).default("color"),
  limit: z.number().int().min(1).max(48).default(12),
  effect: EffectEnum.default("none"),
  // For the cinematic-3d-scroll effect: scroll-speed multiplier. Higher = the
  // fly-through happens over less scrolling (faster); lower = more scroll (slower).
  effectSpeed: z.number().min(0.2).max(2).default(1),
  // Flip Reveal filter tabs for page gallery blocks. Category/location derive
  // tabs from taxonomy memberships; custom tabs carry their own photo choices.
  filterMode: z.enum(["none", "category", "location", "custom"]).default("none"),
  showOverlayText: z.boolean().default(true),
  sortMode: GallerySortEnum.default("source"),
  manualOrderPhotoIds: z.array(z.string()).default([]),
  filterSorts: z.array(GalleryFilterSort).default([]),
  customFilters: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().default("Filter"),
        photoIds: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});
// Banner has its own effect set (Ken Burns / reveal are CSS, distortion is
// WebGL). Kept separate from the gallery's EffectEnum so they don't cross over.
export const BannerEffectEnum = z.enum([
  "none",
  "ken-burns",
  "reveal",
  "css-glitch-1",
  "css-glitch-2",
  "webgl-distortion",
]);
export const BannerLayoutEnum = z.enum([
  "bottom-left",
  "bottom-right",
  "center",
  "split-left",
  "split-right",
  "split-top",
  "split-bottom",
]);
const BannerBlock = z.object({
  ...baseBlock,
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
  // Focal point of the photo within its frame, as object-position percentages
  // (0–100). Drag-set in the editor; the banner keeps this point in view when
  // object-cover crops. Responds on whichever axis the crop has slack.
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  // Zoom/scale the photo past cover (1 = fit, up to 3x). Creates overflow on
  // both axes so the focal point can pan freely regardless of photo shape.
  zoom: z.number().min(1).max(3).default(1),
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
  ...baseBlock,
  type: z.literal("quote"),
  text: z.string().default(""),
  cite: z.string().optional(),
});
const TestimonialItem = z.object({
  id: z.string().min(1),
  name: z.string().default("Client name"),
  affiliation: z.string().default("Studio client"),
  quote: z.string().default("Share what this client said about the experience."),
  photoId: z.string().nullable().default(null),
});
const TestimonialsBlock = z.object({
  ...baseBlock,
  type: z.literal("testimonials"),
  label: z.string().default("Reviews"),
  autoplay: z.boolean().default(false),
  showThumbnails: z.boolean().default(true),
  items: z.array(TestimonialItem).default([]),
});
const TeamMember = z.object({
  id: z.string().min(1),
  name: z.string().default("Team member"),
  role: z.string().default("Role"),
  photoId: z.string().nullable().default(null),
  twitterUrl: z.string().default(""),
  linkedinUrl: z.string().default(""),
  instagramUrl: z.string().default(""),
  behanceUrl: z.string().default(""),
});
const TeamBlock = z.object({
  ...baseBlock,
  type: z.literal("team"),
  title: z.string().default(""),
  grayscale: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  members: z.array(TeamMember).default([]),
});
export const CtaButtonStyleEnum = z.enum([
  "solid",
  "pill",
  "outline",
  "soft",
  "link",
]);
const CtaBlock = z.object({
  ...baseBlock,
  type: z.literal("cta"),
  headline: z.string().default(""),
  body: z.string().optional(),
  buttonLabel: z.string().default("Get in touch"),
  buttonHref: z.string().default("/contact"),
  buttonStyle: CtaButtonStyleEnum.default("pill"),
});
export const ContactFormStyleEnum = z.enum(["stacked", "split", "card", "minimal"]);
const ContactFormBlock = z.object({
  ...baseBlock,
  type: z.literal("contactForm"),
  style: ContactFormStyleEnum.default("stacked"),
  eyebrow: z.string().default("Contact"),
  heading: z.string().default("Get in touch"),
  body: z
    .string()
    .default("Tell me about your session, event, or print order and I'll be in touch soon."),
  submitLabel: z.string().default("Send message"),
  align: AlignEnum.default("left"),
});
const SpacerBlock = z.object({
  ...baseBlock,
  type: z.literal("spacer"),
  size: z.enum(["xs", "sm", "md", "lg", "xl", "custom"]).default("md"),
  mobileSize: z
    .enum(["same", "xs", "sm", "md", "lg", "xl", "custom"])
    .default("same"),
  customHeight: z.number().min(0).max(640).default(112),
  mobileCustomHeight: z.number().min(0).max(640).default(112),
  backgroundMode: z.enum(["none", "muted", "custom"]).default("none"),
  backgroundColor: z.string().default("#f4f4f5"),
  backgroundWidth: z.enum(["full", "content"]).default("full"),
});
const DividerBlock = z.object({
  ...baseBlock,
  type: z.literal("divider"),
  style: z
    .enum(["solid", "dashed", "dotted", "double", "fade", "gradient"])
    .default("solid"),
  thickness: z.enum(["hairline", "thin", "medium", "thick"]).default("hairline"),
  width: z.enum(["full", "content", "narrow"]).default("content"),
  align: AlignEnum.default("center"),
  spacing: z.enum(["tight", "normal", "airy", "custom"]).default("normal"),
  customSpacingTop: z.number().min(0).max(240).default(32),
  customSpacingBottom: z.number().min(0).max(240).default(32),
  colorMode: z.enum(["border", "foreground", "muted", "custom"]).default("border"),
  color: z.string().default("#d4d4d8"),
  backgroundMode: z.enum(["none", "muted", "custom"]).default("none"),
  backgroundColor: z.string().default("#f4f4f5"),
  label: z.string().default(""),
});
// Home-style index sections (cover grids of published categories/locations).
const CategoryIndexBlock = z.object({
  ...baseBlock,
  type: z.literal("categoryIndex"),
  title: z.string().default("By category"),
});
const LocationIndexBlock = z.object({
  ...baseBlock,
  type: z.literal("locationIndex"),
  title: z.string().default("By location"),
});
// Cinematic, scroll-driven showcase: each published category becomes a
// full-screen pinned panel (cover photo background + a few of its photos that
// fly into a cluster + its name as a giant title). Auto-sourced like the index
// blocks; only presentation knobs are stored.
const ScrollShowcaseBlock = z.object({
  ...baseBlock,
  type: z.literal("scrollShowcase"),
  // Optional eyebrow label shown small on each panel (blank = none).
  title: z.string().default(""),
  // Specific categories to show, in this order. Empty = all published
  // categories automatically (capped by `limit`).
  categoryIds: z.array(z.string()).default([]),
  // Max number of category panels (applies only in automatic mode).
  limit: z.number().int().min(1).max(12).default(6),
  // Photos that fly into the cluster per panel (the cover is the background).
  clusterCount: z.number().int().min(1).max(4).default(4),
  // Show the giant category-name titles.
  showTitles: z.boolean().default(true),
  // Render style: cinematic clip-wipe panels, on-scroll 3D carousel, the
  // Codrops ScrollPanels-inspired editorial panel/list treatment, Codrops
  // OnScrollLayoutFormations-style pinned image assemblies, or Codrops
  // ScrollBasedLayoutAnimations-style FLIP layout morphs.
  style: z
    .enum(["cinematic", "carousel3d", "scrollPanels", "layoutFormations", "scrollLayouts"])
    .default("cinematic"),
  // ScrollPanels-only: which Codrops demo motion family to emulate.
  scrollPanelsVariant: z
    .enum(["classic", "scatter", "demo4", "perspective", "zoom", "brightness"])
    .default("classic")
    .optional(),
  // ScrollPanels-only: number of photos in the fixed intro columns.
  scrollPanelsIntroCount: z.number().int().min(6).max(24).default(12).optional(),
  // ScrollPanels-only: number of thumbnails shown in each collection row.
  scrollPanelsRowCount: z.number().int().min(1).max(6).default(5).optional(),
  // ScrollPanels-only: optional initial treatment for the intro photos.
  scrollPanelsTone: z.enum(["color", "grayscale"]).default("color").optional(),
  // ScrollPanels-only: horizontal position of the intro text block.
  scrollPanelsIntroAlign: AlignEnum.default("left").optional(),
  scrollPanelsUseBackground: z.boolean().default(true).optional(),
  scrollPanelsBackground: z.string().default("#f4f0e8").optional(),
  scrollPanelsTextColor: z.string().default("#171717").optional(),
  scrollPanelsIntroHeading: z.string().default("Selected Stories").optional(),
  scrollPanelsIntroText: z
    .string()
    .default("Scroll through featured collections, places, and small visual fragments from the archive.")
    .optional(),
  scrollPanelsShowcaseHeading: z.string().default("Selected Work").optional(),
  // LayoutFormations-only: which Codrops formation family to use.
  layoutFormationsVariant: z
    .enum([
      "rise",
      "columns",
      "zoomed",
      "reveal",
      "tilted",
      "depth",
      "sidePivot",
    ])
    .default("rise")
    .optional(),
  // LayoutFormations-only: horizontal position of the top label block.
  layoutFormationsHeaderAlign: AlignEnum.default("left").optional(),
  layoutFormationsHeading: z.string().default("Layout formations").optional(),
  // LayoutFormations-only: photos used in each assembled layout.
  layoutFormationsPhotoCount: z.number().int().min(6).max(24).default(12).optional(),
  // ScrollLayouts-only: Codrops ScrollBasedLayoutAnimations variant.
  scrollLayoutsVariant: z
    .enum([
      "row",
      "breakout",
      "grid10",
      "stackDark",
      "stackGlass",
      "stackScale",
      "tiny",
      "bento",
      "single",
    ])
    .default("row")
    .optional(),
  scrollLayoutsHeading: z.string().default("Scroll layout morphs").optional(),
  scrollLayoutsIntroText: z
    .string()
    .default("Pinned image layouts morph between editorial compositions as you scroll.")
    .optional(),
  scrollLayoutsPhotoCount: z.number().int().min(1).max(80).default(9).optional(),
  scrollLayoutsCaption: z.string().default("").optional(),
  scrollLayoutsUseBackground: z.boolean().default(true).optional(),
  scrollLayoutsBackground: z.string().default("#131417").optional(),
  scrollLayoutsTextColor: z.string().default("#ffffff").optional(),
});
const InstagramBlock = z.object({
  ...baseBlock,
  type: z.literal("instagram"),
  title: z.string().default("From the field"),
  count: z.number().int().min(1).max(12).default(6),
});
export const FaqStyleEnum = z.enum([
  "accordion",
  "list",
  "cards",
  "bordered",
]);
const FaqItem = z.object({
  q: z.string().default(""),
  a: z.string().default(""),
});
const FaqBlock = z.object({
  ...baseBlock,
  type: z.literal("faq"),
  title: z.string().optional(),
  style: FaqStyleEnum.default("accordion"),
  align: AlignEnum.default("left"),
  items: z.array(FaqItem).default([]),
});
export const LogoStyleEnum = z.enum(["row", "grid", "marquee"]);
export const LogoSpacingEnum = z.enum(["tighter", "tight", "normal", "airy"]);
const LogoBlock = z.object({
  ...baseBlock,
  type: z.literal("logos"),
  title: z.string().optional(),
  // row = centered strip; grid = bordered cells; marquee = scrolling row.
  style: LogoStyleEnum.default("row"),
  grayscale: z.boolean().default(true),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  // Space between logos (gap for row/marquee, cell padding for grid).
  spacing: LogoSpacingEnum.default("normal"),
  photoIds: z.array(z.string()).default([]),
});

export const LeafBlock = z.discriminatedUnion("type", [
  HeadingBlock,
  SubheadingBlock,
  RichTextBlock,
  ImageBlock,
  GalleryBlock,
  BannerBlock,
  QuoteBlock,
  TestimonialsBlock,
  TeamBlock,
  CtaBlock,
  ContactFormBlock,
  SpacerBlock,
  DividerBlock,
  CategoryIndexBlock,
  LocationIndexBlock,
  ScrollShowcaseBlock,
  InstagramBlock,
  FaqBlock,
  LogoBlock,
]);
export type LeafBlock = z.infer<typeof LeafBlock>;

// ── Columns (one level of nesting; holds leaf blocks) ────────────────────────
export const ColAlignEnum = z.enum(["top", "center", "bottom"]);
const ColumnsBlock = z.object({
  ...baseBlock,
  type: z.literal("columns"),
  gap: SpacingEnum.default("normal"),
  columns: z.array(z.array(LeafBlock)).min(1).max(4).default([[], []]),
  // Vertical alignment of each column's content, parallel to `columns`
  // (index i ↔ column i; missing entries default to "top").
  colAlign: z.array(ColAlignEnum).default([]),
  // Horizontal distribution of the columns. "fill" = equal columns spanning the
  // full width (default). "center"/"spread" let each column hug its content and
  // either cluster centered or spread edge-to-edge, so short content stays
  // visually balanced left/right instead of leaving a wide empty last column.
  justify: z.enum(["fill", "center", "spread"]).default("fill"),
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
    if (b.hidden) return;
    if (b.type === "image" && b.photoId) ids.push(b.photoId);
    if (b.type === "banner" && b.photoId) ids.push(b.photoId);
    if (b.type === "testimonials") {
      for (const item of b.items) {
        if (item.photoId) ids.push(item.photoId);
      }
    }
    if (b.type === "team") {
      for (const member of b.members) {
        if (member.photoId) ids.push(member.photoId);
      }
    }
    if (b.type === "logos") ids.push(...b.photoIds);
    if (b.type === "gallery" && b.filterMode === "custom") {
      for (const filter of b.customFilters) ids.push(...filter.photoIds);
    }
    if (b.type === "gallery") {
      ids.push(...b.manualOrderPhotoIds);
      for (const sort of b.filterSorts) ids.push(...sort.photoIds);
    }
  };
  for (const b of blocks) {
    if (b.hidden) continue;
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
  testimonials: "Testimonials",
  team: "Team",
  cta: "Call to action",
  contactForm: "Contact form",
  spacer: "Spacer",
  divider: "Divider",
  columns: "Columns",
  categoryIndex: "Category index",
  locationIndex: "Location index",
  scrollShowcase: "Scroll showcase",
  instagram: "Instagram feed",
  faq: "FAQ",
  logos: "Logos",
};
