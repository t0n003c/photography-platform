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
  "tora-props-catalog",
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
const PortfolioListItem = z.object({
  id,
  title: z.string().default("Free Feelings"),
  category: z.string().default("Women"),
  description: z.string().default("A short project description for this portfolio entry."),
  linkLabel: z.string().default("Read More"),
  linkHref: z.string().default("#"),
  photoId: z.string().nullable().default(null),
  hoverPhotoId: z.string().nullable().default(null),
});
const PortfolioListBlock = z.object({
  ...baseBlock,
  type: z.literal("portfolioList"),
  style: z
    .enum(["modern", "category-cards", "distortion", "animated-masonry", "mix-masonry"])
    .default("modern"),
  eyebrow: z.string().default("PORTFOLIO LIST"),
  title: z.string().default("MODERN"),
  body: z.string().default(""),
  items: z.array(PortfolioListItem).default([]),
  backgroundColor: z.string().default("#242625"),
  textColor: z.string().default("#f8f3df"),
  accentColor: z.string().default("#d8c98d"),
  showBackground: z.boolean().default(true),
});
const AboutLink = z.object({
  id,
  label: z.string().default("Link"),
  href: z.string().default("#"),
});
const AboutBlock = z.object({
  ...baseBlock,
  type: z.literal("about"),
  layout: z.enum(["simple", "modern", "classic", "tora-casting"]).default("simple"),
  sectionEyebrow: z.string().default("ABOUT"),
  sectionTitle: z.string().default("SIMPLE"),
  eyebrow: z.string().default(""),
  headline: z.string().default("HI, I'M REFLECTOR"),
  body: z.string().default(
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam leo sem, feugiat ut tincidunt a, vulputate sed mauris. Proin fringilla risus ut gravida ultrices.\n\nUt ac quam ante. Curabitur sollicitudin scelerisque est, eu commodo libero ornare in.",
  ),
  quote: z.string().default("Cum sociis natoque penatibus et magnis disrient"),
  ctaLabel: z.string().default("learn more"),
  ctaHref: z.string().default("/about"),
  primaryPhotoId: z.string().nullable().default(null),
  secondaryPhotoId: z.string().nullable().default(null),
  tertiaryPhotoId: z.string().nullable().default(null),
  contactTitle: z.string().default("CONTACT"),
  address: z.string().default("231 Main Street Chicago, IL"),
  phoneLabel: z.string().default("Ph:"),
  phoneNumber: z.string().default("3122299000"),
  facebookUrl: z.string().default(""),
  twitterUrl: z.string().default(""),
  instagramUrl: z.string().default(""),
  pressTitle: z.string().default("PRESS"),
  pressLinks: z.array(AboutLink).default([]),
  awardsTitle: z.string().default("AWARDS"),
  awardLinks: z.array(AboutLink).default([]),
  collaboratorsTitle: z.string().default("COLLABORATORS"),
  collaboratorsText: z
    .string()
    .default(
      "The New York Times, Apple, Wired, Cosmopolitan, The Atlantic, The Undefeated, Fast Company, Washington Post, Slate, Texas Monthly Magazine, Red Music Academy, LA Magazine.",
    ),
  showContactForm: z.boolean().default(true),
  contactFormTitle: z.string().default("CONTACT ME"),
  submitLabel: z.string().default("Send"),
});
const ImageComparisonBlock = z.object({
  ...baseBlock,
  type: z.literal("imageComparison"),
  title: z.string().default("Before and after"),
  subtitle: z
    .string()
    .default("Drag the handle to compare the two versions."),
  leftPhotoId: z.string().nullable().default(null),
  rightPhotoId: z.string().nullable().default(null),
  leftLabel: z.string().default("Before"),
  rightLabel: z.string().default("After"),
  comparisonOrientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  initialPosition: z.number().min(5).max(95).default(50),
  aspectRatio: z
    .enum([
      "16-9",
      "3-2",
      "4-3",
      "square",
      "4-5",
      "portrait",
      "3-4",
      "2-3",
      "9-16",
    ])
    .default("16-9"),
  width: z.enum(["normal", "wide", "full"]).default("wide"),
  rounded: z.boolean().default(true),
  showcaseBackground: z.boolean().default(true),
  backgroundColor: z.string().default("#f4f4f5"),
  handleColor: z.string().default("#ffffff"),
});
const FeatureCarouselBlock = z.object({
  ...baseBlock,
  type: z.literal("featureCarousel"),
  headline: z.string().default("Edit Your Photos on the Go"),
  highlightText: z.string().default("Photos"),
  highlightFrom: z.string().default("#3b82f6"),
  highlightTo: z.string().default("#a855f7"),
  subtitle: z
    .string()
    .default(
      "Use all our AI-powered photo editing tools on your phone, available for all iOS and Android.",
    ),
  photoIds: z.array(z.string()).default([]),
  autoplay: z.boolean().default(false),
  autoplayMs: z.number().int().min(1200).max(12000).default(4500),
  showArrows: z.boolean().default(true),
  desktopVisibleCount: z.enum(["3", "5", "7"]).default("3"),
  imageRadius: z.enum(["lg", "xl", "full"]).default("xl"),
  primaryLabel: z.string().default(""),
  primaryHref: z.string().default(""),
  secondaryLabel: z.string().default(""),
  secondaryHref: z.string().default(""),
});
const BookSliderPage = z.object({
  id,
  photoId: z.string().nullable().default(null),
  imageMode: z.enum(["editorial", "full"]).default("editorial"),
  headline: z.string().default("Page headline"),
  subhead: z.string().default("A short supporting line for this page."),
  caption: z.string().default(""),
  linkLabel: z.string().default(""),
  linkHref: z.string().default(""),
});
const BookSliderBlock = z.object({
  ...baseBlock,
  type: z.literal("bookSlider"),
  title: z.string().default("Studio Lookbook"),
  subtitle: z
    .string()
    .default("Click or drag the pages to browse this editorial-style book."),
  coverTitle: z.string().default("Lookbook"),
  coverSubtitle: z.string().default("A curated story in motion"),
  coverPhotoId: z.string().nullable().default(null),
  pages: z.array(BookSliderPage).default([]),
  size: z.enum(["compact", "standard", "large"]).default("standard"),
  pageStyle: z.enum(["soft", "hard"]).default("soft"),
  paperTexture: z.boolean().default(true),
  showcaseBackground: z.boolean().default(true),
  showControls: z.boolean().default(true),
  showPageNumbers: z.boolean().default(true),
  shadowStrength: z.number().min(0).max(1).default(0.45),
  backgroundColor: z.string().default("#f7f1e8"),
  textColor: z.string().default("#2d251d"),
  accentColor: z.string().default("#8b5e34"),
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
const ToraPropsCaptionSource = z.enum(["auto", "headline", "alt", "caption"]);
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
  toraPropsShowBackground: z.boolean().default(true),
  toraPropsBackgroundColor: z.string().default("#252626"),
  toraPropsCaptionColor: z.string().default("#edd8aa"),
  toraPropsShowCaptions: z.boolean().default(true),
  toraPropsCaptionSource: ToraPropsCaptionSource.default("auto"),
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
  "prisma-hero",
  "agency-viral-hero",
  "toramochie-modern",
  "toramochie-creative",
  "toramochie-simple",
  "toramochie-full-wall",
  "toramochie-bottom-text",
  "toramochie-only-image",
  "toramochie-classic",
]);
const BannerBlock = z.object({
  ...baseBlock,
  type: z.literal("banner"),
  // "photo" uses photoId; "featured" pulls the latest featured photo.
  source: z.enum(["photo", "featured"]).default("photo"),
  photoId: z.string().nullable().default(null),
  // Optional multi-photo set used by collage-style banner layouts.
  photoIds: z.array(z.string()).default([]),
  eyebrow: z.string().default(""),
  typewriterWords: z.string().default(""),
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
  // Prisma hero layout: cinematic rounded media frame with optional video,
  // oversized headline, and stacked copy/CTA below it.
  prismaVideoUrl: z.string().default(""),
  prismaShowAsterisk: z.boolean().default(true),
  // Agency viral hero layout: full-screen video/photo hero with centered
  // split headline and CTA, intentionally without the reference floating nav.
  agencyVideoUrl: z.string().default(""),
  agencyAccentText: z.string().default(""),
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
  layout: z.enum(["slider", "portrait-grid", "retro-carousel", "glass-stack"]).default("slider"),
  label: z.string().default("Reviews"),
  title: z.string().default("See what all the talk is about!"),
  subtitle: z
    .string()
    .default("Transformative client experience from all around the globe"),
  gridPanel: z.boolean().default(true),
  gridColumns: z.enum(["2", "3"]).default("3"),
  glassShowcaseBackground: z.boolean().default(true),
  glassShowcaseBackgroundColor: z.string().default("#0d1324"),
  autoplay: z.boolean().default(false),
  showThumbnails: z.boolean().default(true),
  items: z.array(TestimonialItem).default([]),
});
const TeamMember = z.object({
  id: z.string().min(1),
  name: z.string().default("Team member"),
  role: z.string().default("Role"),
  description: z
    .string()
    .default(
      "Share a short bio, specialty, or role description for this team member.",
    ),
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
  layout: z
    .enum(["showcase", "memberCards", "marqueeCards", "creativeSection", "orbitCarousel"])
    .default("showcase"),
  cardPosition: z.enum(["alternate", "left", "right"]).default("alternate"),
  showCardArrow: z.boolean().default(true),
  creativeEyebrow: z.string().default("O U R"),
  creativeDescription: z
    .string()
    .default(
      "Meet the people behind the images, edits, and client experience.",
    ),
  creativeLogo: z.string().default("RAVI"),
  creativeColumns: z.enum(["3", "4"]).default("3"),
  creativeShowCardOutline: z.boolean().default(true),
  creativeCtaLabel: z.string().default("REGISTER NOW"),
  creativeCtaHref: z.string().default("#"),
  creativeShowMainSocials: z.boolean().default(true),
  creativeTwitterUrl: z.string().default("#"),
  creativeFacebookUrl: z.string().default("#"),
  creativeInstagramUrl: z.string().default("#"),
  creativeYoutubeUrl: z.string().default("#"),
  creativeWebsiteLabel: z.string().default("www.website.com"),
  creativeWebsiteHref: z.string().default("#"),
  marqueeSubtitle: z
    .string()
    .default(
      "Meet the people behind the images, edits, and client experience.",
    ),
  marqueeSpeed: z.number().default(32),
  marqueePauseOnHover: z.boolean().default(true),
  marqueeShowDecorations: z.boolean().default(true),
  marqueeShowQuote: z.boolean().default(true),
  marqueeQuote: z
    .string()
    .default(
      "The care, communication, and delivery from this team made the entire experience feel effortless.",
    ),
  marqueeQuoteAuthor: z.string().default("Natalia Kara"),
  marqueeQuoteRole: z.string().default("Studio client"),
  marqueeQuotePhotoId: z.string().nullable().default(null),
  orbitSubtitle: z
    .string()
    .default(
      "Select a team member from the orbit to learn more about their role.",
    ),
  orbitRingCount: z.enum(["auto", "1", "2", "3"]).default("auto"),
  orbitAutoplay: z.boolean().default(true),
  orbitSpeed: z.number().int().min(2000).max(15000).default(5000),
  orbitPauseOnHover: z.boolean().default(true),
  orbitShowDots: z.boolean().default(true),
  orbitShowIconAccents: z.boolean().default(true),
  orbitButtonLabel: z.string().default("Connect"),
  orbitButtonHref: z.string().default("#"),
  grayscale: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  members: z.array(TeamMember).default([]),
});
const PricingFeature = z.object({
  id: z.string().min(1),
  text: z.string().default("Feature"),
  tooltip: z.string().default(""),
  included: z.boolean().default(true),
});
const PricingPlan = z.object({
  id: z.string().min(1),
  name: z.string().default("Plan"),
  info: z.string().default("For most clients"),
  photoId: z.string().nullable().default(null),
  mediaPhotoId: z.string().nullable().default(null),
  mediaVideoUrl: z.string().default(""),
  monthlyPrice: z.number().default(7),
  yearlyPrice: z.number().default(74),
  priceLabel: z.string().default(""),
  highlighted: z.boolean().default(false),
  ctaLabel: z.string().default("Get started"),
  ctaHref: z.string().default("#"),
  features: z.array(PricingFeature).default([]),
});
const PricingBlock = z.object({
  ...baseBlock,
  type: z.literal("pricing"),
  style: z
    .enum([
      "standard",
      "glass-gradient",
      "tora-classic",
      "tora-creative",
      "tora-modern",
      "tora-simple",
      "tora-with-media",
      "tora-image-background",
      "tora-casting-services",
    ])
    .default("standard"),
  heading: z.string().default("Plans that Scale with You"),
  description: z
    .string()
    .default(
      "Whether you're just starting out or growing fast, our flexible pricing has you covered - with no hidden costs.",
    ),
  currency: z.string().default("$"),
  defaultFrequency: z.enum(["monthly", "yearly"]).default("monthly"),
  showBillingToggle: z.boolean().default(true),
  theme: z.enum(["auto", "dark", "light"]).default("auto"),
  showHighlightEffect: z.boolean().default(true),
  castingImageRatio: z
    .enum(["reference", "wide", "landscape", "square", "portrait"])
    .default("reference"),
  plans: z.array(PricingPlan).default([]),
});
const ShopBlock = z.object({
  ...baseBlock,
  type: z.literal("shop"),
  style: z.enum(["tora-grid", "tora-coming-soon"]).default("tora-grid"),
  title: z.string().default("SHOP"),
  body: z
    .string()
    .default("Browse prints, digital downloads, and curated bundles."),
  source: z.enum(["all", "featured", "category"]).default("all"),
  category: z.string().default(""),
  limit: z.number().int().min(1).max(48).default(12),
  showSidebar: z.boolean().default(true),
  showSearch: z.boolean().default(true),
  showTagCloud: z.boolean().default(true),
  showSorting: z.boolean().default(true),
  showSaleBadge: z.boolean().default(true),
  showPrices: z.boolean().default(true),
  theme: z.enum(["auto", "dark", "light"]).default("auto"),
  backgroundColor: z.string().default("#252626"),
  textColor: z.string().default("#f7f7f7"),
  accentColor: z.string().default("#ddc59f"),
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
export const ContactFormStyleEnum = z.enum([
  "stacked",
  "split",
  "card",
  "minimal",
  "tora-contact",
]);
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
const CoordinateString = z
  .preprocess((value) => (typeof value === "number" ? String(value) : value), z.string())
  .default("");
const LocationMapCustomPin = z.object({
  id,
  title: z.string().default("Custom pin"),
  subtitle: z.string().default(""),
  lat: CoordinateString,
  lng: CoordinateString,
  photoId: z.string().nullable().default(null),
  linkLabel: z.string().default(""),
  linkHref: z.string().default(""),
});
const LocationMapNetworkConnection = z.object({
  id,
  startId: z.string().default(""),
  endId: z.string().default(""),
});
const LocationMapBlock = z.object({
  ...baseBlock,
  type: z.literal("locationMap"),
  title: z.string().default("Explore locations"),
  subtitle: z
    .string()
    .default("Tap a marker to preview the work photographed in each place."),
  locationIds: z.array(z.string()).default([]),
  customPins: z.array(LocationMapCustomPin).default([]),
  displayMode: z.enum(["interactive", "dotted-network", "route-planning"]).default("interactive"),
  height: z.enum(["sm", "md", "lg", "screen"]).default("md"),
  mapTheme: z.enum(["auto", "light", "dark", "liberty", "bright"]).default("auto"),
  markerColor: z.string().default("#f43f5e"),
  showLabels: z.boolean().default(true),
  showControls: z.boolean().default(true),
  popupMode: z.enum(["click", "hover"]).default("click"),
  networkConnectionMode: z.enum(["ordered", "hub", "manual"]).default("ordered"),
  networkConnections: z.array(LocationMapNetworkConnection).default([]),
  networkLineColor: z.string().default("#0ea5e9"),
  networkDotColor: z.string().default("#f43f5e"),
  networkMapDotColor: z.string().default("#94a3b8"),
  networkAnimationSeconds: z.number().min(1).max(12).default(3.2),
  networkShowLabels: z.boolean().default(true),
  routeStyle: z.enum(["planning", "basic"]).default("planning"),
  routeProvider: z.enum(["osrm", "straight"]).default("osrm"),
  routeTravelMode: z.enum(["driving", "walking", "cycling"]).default("driving"),
  routePointIds: z.array(z.string()).default([]),
  routeStartId: z.string().default(""),
  routeEndId: z.string().default(""),
  routeShowAlternatives: z.boolean().default(true),
  routeShowCards: z.boolean().default(true),
  routeShowStopList: z.boolean().default(true),
  routeShowMapLinks: z.boolean().default(true),
  routeSummaryPosition: z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).default("top-left"),
  routeSummaryStyle: z.enum(["solid", "glass", "minimal"]).default("solid"),
  routeShowLabels: z.boolean().default(true),
  routeLineColor: z.string().default("#6366f1"),
  routeInactiveLineColor: z.string().default("#94a3b8"),
  routeStartColor: z.string().default("#22c55e"),
  routeEndColor: z.string().default("#ef4444"),
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
  PortfolioListBlock,
  AboutBlock,
  ImageComparisonBlock,
  FeatureCarouselBlock,
  BookSliderBlock,
  GalleryBlock,
  BannerBlock,
  QuoteBlock,
  TestimonialsBlock,
  TeamBlock,
  PricingBlock,
  ShopBlock,
  CtaBlock,
  ContactFormBlock,
  SpacerBlock,
  DividerBlock,
  CategoryIndexBlock,
  LocationIndexBlock,
  LocationMapBlock,
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
    if (b.type === "portfolioList") {
      for (const item of b.items) {
        if (item.photoId) ids.push(item.photoId);
        if (item.hoverPhotoId) ids.push(item.hoverPhotoId);
      }
    }
    if (b.type === "about") {
      if (b.primaryPhotoId) ids.push(b.primaryPhotoId);
      if (b.secondaryPhotoId) ids.push(b.secondaryPhotoId);
      if (b.tertiaryPhotoId) ids.push(b.tertiaryPhotoId);
    }
    if (b.type === "imageComparison") {
      if (b.leftPhotoId) ids.push(b.leftPhotoId);
      if (b.rightPhotoId) ids.push(b.rightPhotoId);
    }
    if (b.type === "featureCarousel") ids.push(...b.photoIds);
    if (b.type === "bookSlider") {
      if (b.coverPhotoId) ids.push(b.coverPhotoId);
      for (const page of b.pages) {
        if (page.photoId) ids.push(page.photoId);
      }
    }
    if (b.type === "banner") {
      if (b.photoId) ids.push(b.photoId);
      ids.push(...(b.photoIds ?? []));
    }
    if (b.type === "testimonials") {
      for (const item of b.items) {
        if (item.photoId) ids.push(item.photoId);
      }
    }
    if (b.type === "team") {
      if (b.marqueeQuotePhotoId) ids.push(b.marqueeQuotePhotoId);
      for (const member of b.members) {
        if (member.photoId) ids.push(member.photoId);
      }
    }
    if (b.type === "pricing") {
      for (const plan of b.plans) {
        if (plan.photoId) ids.push(plan.photoId);
        if (plan.mediaPhotoId) ids.push(plan.mediaPhotoId);
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
    if (b.type === "locationMap") {
      for (const pin of b.customPins) {
        if (pin.photoId) ids.push(pin.photoId);
      }
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
  portfolioList: "Portfolio list",
  about: "About",
  imageComparison: "Image comparison",
  featureCarousel: "Feature carousel",
  bookSlider: "Book slider",
  gallery: "Gallery",
  banner: "Banner",
  quote: "Quote",
  testimonials: "Testimonials",
  team: "Team",
  pricing: "Price",
  shop: "Shop",
  cta: "Call to action",
  contactForm: "Contact form",
  spacer: "Spacer",
  divider: "Divider",
  columns: "Columns",
  categoryIndex: "Category index",
  locationIndex: "Location index",
  locationMap: "Location map",
  scrollShowcase: "Scroll showcase",
  instagram: "Instagram feed",
  faq: "FAQ",
  logos: "Logos",
};
