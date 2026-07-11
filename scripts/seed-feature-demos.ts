import { desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db/client";
import { generateShareToken } from "@/src/auth/grant";
import { ensureMenusSeeded, invalidateMenu } from "@/src/db/queries/menus";
import {
  client,
  collection,
  collectionPhoto,
  gallery,
  galleryAccessGrant,
  galleryPhoto,
  location,
  menu,
  menuItem,
  page,
  pageConfig,
  photo,
  photoLocation,
  user,
} from "@/src/db/schema";
import { Block as BlockSchema, parseBlocks } from "@/src/lib/blocks";
import { getEnv } from "@/src/lib/env";
import { newId } from "@/src/lib/id";

type BlockInput = Record<string, unknown>;
type PageType = typeof page.$inferInsert.type;
type PageConfigScope = typeof pageConfig.$inferInsert.scope;
type PageConfigGridType = NonNullable<typeof pageConfig.$inferInsert.gridType>;
type PageConfigTheme = NonNullable<typeof pageConfig.$inferInsert.theme>;

interface DemoPage {
  id: string;
  slug: string;
  title: string;
  type: PageType;
  theme?: PageConfigTheme;
  seoDescription: string;
  blocks: BlockInput[];
}

interface DemoPageConfig {
  id: string;
  scope: PageConfigScope;
  gridType: PageConfigGridType | null;
  spacing: string;
  theme: PageConfigTheme;
  hero: Record<string, unknown> | null;
  config: Record<string, unknown>;
}

interface DemoGallery {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  gridType: PageConfigGridType;
  spacing?: string;
  theme?: PageConfigTheme;
  config?: Record<string, unknown>;
  photoStart: number;
  photoCount: number;
  visibility?: "public" | "private";
  clientId?: string | null;
  downloadEnabled?: boolean;
}

interface DemoCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  photoStart: number;
  photoCount: number;
}

interface DemoLocation {
  id: string;
  slug: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  sortOrder: number;
  photoStart: number;
  photoCount: number;
}

const BASE = "demo-feature";
const MENU_LABEL = "Feature Demos";
const DEMO_CLIENT_ID = `${BASE}-client-proofing`;
const DEMO_OWNER_ID = `${BASE}-owner`;

const BANNER_DEFAULTS = {
  source: "photo",
  height: "tall",
  overlay: "auto",
  focalX: 50,
  focalY: 50,
  zoom: 1,
  headlineFont: "sans",
  headlineSize: "lg",
  headlineTracking: "normal",
  headlineCase: "normal",
  buttonStyle: "pill",
  effect: "none",
  prismaVideoUrl: "",
  prismaShowAsterisk: true,
  agencyVideoUrl: "",
  agencyAccentText: "",
};

const GALLERY_DEFAULTS = {
  source: "featured",
  targetId: null,
  gridType: "justified",
  spacing: "normal",
  autoplay: false,
  backdrop: "color",
  limit: 12,
  effect: "none",
  effectSpeed: 1,
  filterMode: "none",
  filterStyle: "flip-reveal",
  showOverlayText: true,
  toraPortfolioFilterTextSize: 30,
  toraPortfolioSeparatorSize: 55,
  sortMode: "source",
  manualOrderPhotoIds: [],
  filterSorts: [],
  customFilters: [],
  toraPropsShowBackground: true,
  toraPropsBackgroundColor: "#252626",
  toraPropsCaptionColor: "#edd8aa",
  toraPropsShowCaptions: true,
  toraPropsCaptionSource: "auto",
  toraJustifiedUseBackground: true,
  toraJustifiedBackgroundColor: "#252626",
  toraJustifiedTitleColor: "#f7f7f7",
  toraJustifiedAccentColor: "#edd8aa",
  toraJustifiedTitleSource: "auto",
  toraJustifiedRowHeightFactor: 7,
  toraJustifiedDesktopGutter: 25,
  toraJustifiedMobileGutter: 15,
  toraJustifiedHoverInset: true,
  toraJustifiedDimOnLeadHover: true,
  toraJustifiedScrollOnSelect: true,
  toraJustifiedShowBlurredSideFill: true,
};

const pageSlugs = [
  "demo-features",
  "demo-hero-banner-layouts",
  "demo-content-typography",
  "demo-info-block-styles",
  "demo-portfolio-list-styles",
  "demo-about-profile-styles",
  "demo-media-interaction-tools",
  "demo-gallery-block-grids",
  "demo-gallery-filter-systems",
  "demo-scroll-showcase-core",
  "demo-scroll-panels-variants",
  "demo-layout-formation-variants",
  "demo-scroll-layout-variants",
  "demo-proof-team-logos-faq",
  "demo-pricing-styles",
  "demo-contact-styles",
  "demo-commerce-conversion",
  "demo-maps-taxonomy",
] as const;

const demoCategories: DemoCategory[] = [
  {
    id: `${BASE}-category-editorial-portraits`,
    slug: "demo-editorial-portraits",
    name: "Editorial Portraits",
    description:
      "Quiet studio portraits with clean direction, close crops, and tactile color.",
    sortOrder: 210,
    photoStart: 0,
    photoCount: 18,
  },
  {
    id: `${BASE}-category-event-stories`,
    slug: "demo-event-stories",
    name: "Event Stories",
    description:
      "Documentary coverage for ceremonies, gatherings, and private celebrations.",
    sortOrder: 211,
    photoStart: 16,
    photoCount: 18,
  },
  {
    id: `${BASE}-category-nature-landscapes`,
    slug: "demo-nature-landscapes",
    name: "Nature Landscapes",
    description:
      "Open-air studies for travel journals, wall art, and seasonal campaigns.",
    sortOrder: 212,
    photoStart: 32,
    photoCount: 20,
  },
  {
    id: `${BASE}-category-wedding-details`,
    slug: "demo-wedding-details",
    name: "Wedding Details",
    description: "Soft moments, layered styling, and heirloom-ready detail coverage.",
    sortOrder: 213,
    photoStart: 48,
    photoCount: 18,
  },
  {
    id: `${BASE}-category-commercial-sets`,
    slug: "demo-commercial-sets",
    name: "Commercial Sets",
    description:
      "Brand-forward image sets for launches, lookbooks, and campaign libraries.",
    sortOrder: 214,
    photoStart: 64,
    photoCount: 18,
  },
];

const demoLocations: DemoLocation[] = [
  {
    id: `${BASE}-location-chicago-studio`,
    slug: "demo-chicago-studio",
    name: "Chicago Studio",
    region: "Illinois",
    lat: 41.8781,
    lng: -87.6298,
    sortOrder: 220,
    photoStart: 4,
    photoCount: 14,
  },
  {
    id: `${BASE}-location-denver-highlands`,
    slug: "demo-denver-highlands",
    name: "Denver Highlands",
    region: "Colorado",
    lat: 39.7392,
    lng: -104.9903,
    sortOrder: 221,
    photoStart: 22,
    photoCount: 14,
  },
  {
    id: `${BASE}-location-seattle-waterfront`,
    slug: "demo-seattle-waterfront",
    name: "Seattle Waterfront",
    region: "Washington",
    lat: 47.6062,
    lng: -122.3321,
    sortOrder: 222,
    photoStart: 40,
    photoCount: 14,
  },
  {
    id: `${BASE}-location-arkansas-trails`,
    slug: "demo-arkansas-trails",
    name: "Arkansas Trails",
    region: "Arkansas",
    lat: 34.7465,
    lng: -92.2896,
    sortOrder: 223,
    photoStart: 58,
    photoCount: 14,
  },
  {
    id: `${BASE}-location-new-york-editorial`,
    slug: "demo-new-york-editorial",
    name: "New York Editorial",
    region: "New York",
    lat: 40.7128,
    lng: -74.006,
    sortOrder: 224,
    photoStart: 72,
    photoCount: 12,
  },
];

function idFactory(prefix: string) {
  let count = 0;
  return (name = "block") => `${prefix}-${name}-${++count}`;
}

function grid(value: PageConfigGridType): PageConfigGridType {
  return value;
}

function galleryConfig(config: Record<string, unknown> = {}) {
  return {
    hlOverlay: "minimal",
    altUseBackground: true,
    altBackgroundColor: "#b7b19f",
    altTextColor: "#111111",
    altShowText: true,
    imgTrailVariant: "fade-shrink",
    imgTrailUseBackground: true,
    imgTrailBackgroundColor: "#efece5",
    rotatingScrollVariant: "demo5",
    rotatingScrollUseBackground: true,
    rotatingScrollBackgroundColor: "#141414",
    rotatingScrollMarqueeText: "FEATURE DEMO - STUDIO WORK - ",
    diagonalUseBackground: true,
    diagonalBackgroundColor: "#0c0c0c",
    diagonalTextColor: "#f1f1f1",
    diagonalDecoColor: "#141414",
    diagonalSideText: "FEATURE DEMO",
    diagonalShowSideText: true,
    diagonalShowDetail: true,
    depthUseMoodBackground: true,
    depthShowTrail: true,
    depthShowParticles: true,
    depthLabelStyle: "color-chip",
    depthScrollSpeed: "normal",
    depthBackgroundColor: "#fffaf0",
    infiniteBackgroundColor: "#f4f1ea",
    infiniteFogColor: "#f4f1ea",
    infiniteDensity: "normal",
    infiniteImageSize: "medium",
    infiniteMovement: "normal",
    infiniteShowControls: true,
    infiniteEnableKeyboard: true,
    palmerDensity: "normal",
    palmerItemSize: "medium",
    palmerShowDetails: true,
    palmerUseCustomColors: false,
    palmerBackgroundColor: "#f1f1f1",
    palmerTextColor: "#313131",
    toraSliphoverUseBackground: true,
    toraSliphoverBackgroundColor: "#f3eadb",
    toraSliphoverLabelSource: "auto",
    toraSliphoverLabelBackgroundColor: "#111111",
    toraSliphoverLabelTextColor: "#f8f3df",
    toraJustifiedUseBackground: true,
    toraJustifiedBackgroundColor: "#252626",
    toraJustifiedTitleColor: "#f7f7f7",
    toraJustifiedAccentColor: "#edd8aa",
    toraJustifiedTitleSource: "auto",
    toraJustifiedRowHeightFactor: 7,
    toraJustifiedDesktopGutter: 25,
    toraJustifiedMobileGutter: 15,
    toraJustifiedHoverInset: true,
    toraJustifiedDimOnLeadHover: true,
    toraJustifiedScrollOnSelect: true,
    toraJustifiedShowBlurredSideFill: true,
    ...config,
  };
}

function validateBlocks(slug: string, blocks: BlockInput[]) {
  blocks.forEach((block, index) => {
    const parsed = BlockSchema.safeParse(block);
    if (!parsed.success) {
      throw new Error(
        `[seed-feature-demos] invalid block on ${slug} at index ${index}: ${parsed.error.message}`,
      );
    }
  });
  const parsed = parseBlocks(blocks);
  if (parsed.length !== blocks.length) {
    throw new Error(
      `[seed-feature-demos] ${slug}: ${blocks.length - parsed.length} blocks were dropped`,
    );
  }
  return parsed;
}

function pageIntro(
  id: () => string,
  label: string,
  title: string,
  body: string,
  photoId: string,
): BlockInput[] {
  return [
    {
      id: id(),
      type: "banner",
      ...BANNER_DEFAULTS,
      photoId,
      layout: "toramochie-modern",
      eyebrow: label,
      headline: title,
      subhead: body,
      ctaLabel: "View sections",
      ctaHref: "#sections",
      height: "tall",
      overlay: "dark",
      effect: "ken-burns",
    },
    {
      id: id(),
      type: "heading",
      text: title,
      level: 2,
      align: "center",
      font: "playfair",
      spacing: "normal",
      headingStyle: "tora-modern",
      label,
      body,
    },
  ];
}

function rich(
  id: string,
  text: string,
  size: "sm" | "base" | "lg" | "xl" = "base",
): BlockInput {
  return {
    id,
    type: "richtext",
    text,
    align: "center",
    font: "sans",
    size,
  };
}

function divider(id: string, label = ""): BlockInput {
  return {
    id,
    type: "divider",
    style: label ? "double" : "fade",
    thickness: "thin",
    width: "content",
    align: "center",
    spacing: "normal",
    colorMode: "muted",
    backgroundMode: "none",
    label,
  };
}

function spacer(id: string, size: "xs" | "sm" | "md" | "lg" | "xl" = "md"): BlockInput {
  return {
    id,
    type: "spacer",
    size,
    mobileSize: size === "xl" ? "lg" : "same",
    customHeight: 112,
    mobileCustomHeight: 88,
    backgroundMode: "none",
    backgroundWidth: "full",
  };
}

function customLinkBlock(
  id: string,
  layout: "link-row" | "center-button",
  items: Array<{ title: string; subtitle: string; href: string }>,
): BlockInput {
  return {
    id,
    type: "customLink",
    layout,
    items: items.map((item, index) => ({ id: `${id}-item-${index}`, ...item })),
    buttonLabel: items[0]?.title ?? "More stories",
    buttonHref: items[0]?.href ?? "#",
    showBackground: layout === "link-row",
    backgroundColor: "#252626",
    textColor: "#f8f3df",
    accentColor: "#d8c98d",
  };
}

async function ensureOwner() {
  const existing = await db
    .select({ id: user.id })
    .from(user)
    .orderBy(user.createdAt)
    .limit(1);
  if (existing[0]) return existing[0].id;

  await db.insert(user).values({
    id: DEMO_OWNER_ID,
    name: "Feature Demo Owner",
    email: "feature-demo-owner@example.invalid",
    emailVerified: true,
    role: "staff",
  });
  return DEMO_OWNER_ID;
}

async function preservePhotoMetadata(
  photoIds: string[],
  titleFor: (index: number) => string,
) {
  for (let i = 0; i < photoIds.length; i += 1) {
    const title = titleFor(i);
    await db
      .update(photo)
      .set({
        headline: sql<string>`case when ${photo.headline} is null or ${photo.headline} = '' then ${title} else ${photo.headline} end`,
        subhead: sql<string>`case when ${photo.subhead} is null or ${photo.subhead} = '' then ${`Feature demo frame ${i + 1}`} else ${photo.subhead} end`,
        caption: sql<string>`case when ${photo.caption} is null or ${photo.caption} = '' then ${"A curated demo photograph used to exercise the public layout system."} else ${photo.caption} end`,
        altText: sql<string>`case when ${photo.altText} is null or ${photo.altText} = '' then ${`${title} photography sample`} else ${photo.altText} end`,
      })
      .where(eq(photo.id, photoIds[i]));
  }
}

async function main() {
  const [photoRows, productRows] = await Promise.all([
    db
      .select({ id: photo.id })
      .from(photo)
      .where(eq(photo.processingStatus, "ready"))
      .orderBy(desc(photo.createdAt))
      .limit(84),
    db.execute(sql`select count(*)::int as count from product where is_active = true`),
  ]);

  const photoIds = photoRows.map((row) => row.id);
  if (photoIds.length < 24) {
    throw new Error(
      `[seed-feature-demos] at least 24 ready photos are required; found ${photoIds.length}`,
    );
  }

  const productCount = Number(
    (productRows as unknown as Array<{ count: number }>)[0]?.count ?? 0,
  );
  const ownerId = await ensureOwner();
  const pick = (index: number) => photoIds[index % photoIds.length];
  const group = (start: number, count: number) =>
    Array.from({ length: count }, (_, index) => pick(start + index));
  const sliderSlides = (start: number, count: number, prefix: string) =>
    group(start, count).map((photoId, index) => ({
      id: `${prefix}-slide-${index + 1}`,
      photoId,
      subtitle: index % 2 === 0 ? "editorial story" : "studio notes",
      headline: ["Still Light", "Soft Motion", "Clean Frame", "Afterglow"][index % 4],
      buttonLabel: "View story",
      buttonHref: "/demo-features",
    }));

  await preservePhotoMetadata(group(0, 84), (index) => {
    const names = [
      "Still Light",
      "Soft Motion",
      "Open Air",
      "Quiet Detail",
      "Studio Proof",
      "Long Horizon",
      "Color Study",
      "Editorial Frame",
    ];
    return `${names[index % names.length]} ${index + 1}`;
  });

  const demoGalleries: DemoGallery[] = [
    {
      id: `${BASE}-gallery-masonry`,
      slug: "demo-gallery-masonry",
      title: "Masonry Journal",
      subtitle: "Classic staggered gallery",
      description: "A clean masonry gallery for mixed portrait and landscape frames.",
      gridType: "masonry",
      spacing: "normal",
      photoStart: 0,
      photoCount: 18,
    },
    {
      id: `${BASE}-gallery-justified`,
      slug: "demo-gallery-justified",
      title: "Justified Narrative",
      subtitle: "Rows with natural image rhythm",
      description: "A justified public gallery tuned for editorial story sets.",
      gridType: "justified",
      spacing: "normal",
      photoStart: 6,
      photoCount: 18,
    },
    {
      id: `${BASE}-gallery-uniform`,
      slug: "demo-gallery-uniform",
      title: "Uniform Contact Sheet",
      subtitle: "Consistent card crops",
      description: "A structured uniform grid for client proofing and image review.",
      gridType: "uniform",
      spacing: "tight",
      photoStart: 12,
      photoCount: 18,
    },
    {
      id: `${BASE}-gallery-horizontal-minimal`,
      slug: "demo-gallery-horizontal-minimal",
      title: "Horizontal Minimal",
      subtitle: "Reduced overlay detail",
      description: "A horizontal Lenis gallery with the minimal detail overlay.",
      gridType: "horizontal-lenis",
      config: galleryConfig({ hlOverlay: "minimal" }),
      photoStart: 18,
      photoCount: 20,
    },
    {
      id: `${BASE}-gallery-horizontal-editorial`,
      slug: "demo-gallery-horizontal-editorial",
      title: "Horizontal Editorial",
      subtitle: "Large editorial overlay",
      description: "Horizontal scroll with an editorial click-through overlay.",
      gridType: "horizontal-lenis",
      config: galleryConfig({ hlOverlay: "editorial" }),
      photoStart: 22,
      photoCount: 20,
    },
    {
      id: `${BASE}-gallery-horizontal-centered`,
      slug: "demo-gallery-horizontal-centered",
      title: "Horizontal Centered",
      subtitle: "Balanced centered overlay",
      description:
        "Horizontal scroll with a centered presentation for clean campaigns.",
      gridType: "horizontal-lenis",
      config: galleryConfig({ hlOverlay: "centered" }),
      photoStart: 26,
      photoCount: 20,
    },
    {
      id: `${BASE}-gallery-parallax-ring`,
      slug: "demo-gallery-parallax-ring",
      title: "Parallax Ring Study",
      subtitle: "Orbital cover movement",
      description: "A dimensional ring treatment for a high-impact gallery entrance.",
      gridType: "parallax-ring",
      photoStart: 30,
      photoCount: 18,
    },
    {
      id: `${BASE}-gallery-css-glitch`,
      slug: "demo-gallery-css-glitch",
      title: "Glitch Hover Contact Sheet",
      subtitle: "CSS hover distortion",
      description: "A no-WebGL hover effect for bold image browsing.",
      gridType: "css-glitch",
      photoStart: 34,
      photoCount: 18,
    },
    ...(
      [
        "fade-shrink",
        "zoom-fade",
        "drop",
        "scatter",
        "stretch-drop",
        "full-frame",
      ] as const
    ).map((variant, index) => ({
      id: `${BASE}-gallery-image-trail-${variant}`,
      slug: `demo-gallery-image-trail-${variant}`,
      title: `Image Trail ${variant.replace(/-/g, " ")}`,
      subtitle: "Pointer-follow trail interaction",
      description: `Image Trail variant ${variant} for motion-led portfolio browsing.`,
      gridType: grid("image-trail"),
      config: galleryConfig({
        imgTrailVariant: variant,
        imgTrailUseBackground: index !== 5,
        imgTrailBackgroundColor: index % 2 === 0 ? "#efece5" : "#f6f3ed",
      }),
      photoStart: 8 + index * 4,
      photoCount: 18,
    })),
    ...(["demo1", "demo2", "demo3", "demo4", "demo5"] as const).map(
      (variant, index) => ({
        id: `${BASE}-gallery-rotating-${variant}`,
        slug: `demo-gallery-rotating-${variant}`,
        title: `Rotating Scroll ${variant.toUpperCase()}`,
        subtitle: "Codrops-inspired rotating scroll",
        description: `Rotating scroll variant ${variant} with its own color and marquee settings.`,
        gridType: grid("rotating-scroll"),
        config: galleryConfig({
          rotatingScrollVariant: variant,
          rotatingScrollUseBackground: index !== 1,
          rotatingScrollBackgroundColor: [
            "#141414",
            "#efece5",
            "#10131a",
            "#242625",
            "#111111",
          ][index],
          rotatingScrollMarqueeText: "ROTATING SCROLL - FEATURE DEMO - ",
        }),
        photoStart: 14 + index * 5,
        photoCount: 18,
      }),
    ),
    {
      id: `${BASE}-gallery-diagonal-dark`,
      slug: "demo-gallery-diagonal-dark",
      title: "Diagonal Slideshow Dark",
      subtitle: "Dark diagonal presentation",
      description: "A full-screen diagonal slideshow with side text and detail copy.",
      gridType: grid("diagonal-slideshow"),
      config: galleryConfig({
        diagonalUseBackground: true,
        diagonalBackgroundColor: "#0c0c0c",
        diagonalTextColor: "#f1f1f1",
        diagonalDecoColor: "#191919",
        diagonalSideText: "DIAGONAL",
      }),
      photoStart: 42,
      photoCount: 16,
    },
    {
      id: `${BASE}-gallery-diagonal-light`,
      slug: "demo-gallery-diagonal-light",
      title: "Diagonal Slideshow Light",
      subtitle: "Light editorial presentation",
      description: "A lighter diagonal slideshow without the vertical side label.",
      gridType: grid("diagonal-slideshow"),
      config: galleryConfig({
        diagonalUseBackground: true,
        diagonalBackgroundColor: "#f5efe6",
        diagonalTextColor: "#171717",
        diagonalDecoColor: "#eadfce",
        diagonalShowSideText: false,
        diagonalShowDetail: true,
      }),
      photoStart: 48,
      photoCount: 16,
    },
    {
      id: `${BASE}-gallery-diagonal-minimal`,
      slug: "demo-gallery-diagonal-minimal",
      title: "Diagonal Slideshow Minimal",
      subtitle: "Image-first diagonal motion",
      description: "A minimal diagonal slideshow with detail text disabled.",
      gridType: grid("diagonal-slideshow"),
      config: galleryConfig({
        diagonalUseBackground: false,
        diagonalShowDetail: false,
        diagonalSideText: "MINIMAL",
      }),
      photoStart: 54,
      photoCount: 16,
    },
    ...(["color-chip", "metadata", "minimal"] as const).map((labelStyle, index) => ({
      id: `${BASE}-gallery-depth-${labelStyle}`,
      slug: `demo-gallery-depth-${labelStyle}`,
      title: `Depth Gallery ${labelStyle.replace(/-/g, " ")}`,
      subtitle: "WebGL depth-plane movement",
      description: `Depth gallery label style ${labelStyle}, with mood, trail, and particle options represented.`,
      gridType: grid("depth-gallery"),
      config: galleryConfig({
        depthLabelStyle: labelStyle,
        depthScrollSpeed: (["slow", "normal", "fast"] as const)[index],
        depthUseMoodBackground: index !== 2,
        depthShowTrail: index !== 1,
        depthShowParticles: index !== 2,
        depthBackgroundColor: ["#fffaf0", "#edf3f8", "#f5f5f4"][index],
      }),
      photoStart: 2 + index * 9,
      photoCount: 18,
    })),
    ...(["sparse", "normal", "dense"] as const).map((density, index) => ({
      id: `${BASE}-gallery-infinite-${density}`,
      slug: `demo-gallery-infinite-${density}`,
      title: `Infinite Canvas ${density}`,
      subtitle: "Explorable canvas gallery",
      description: `Infinite canvas density ${density} with size, movement, controls, and keyboard options.`,
      gridType: grid("infinite-canvas"),
      config: galleryConfig({
        infiniteDensity: density,
        infiniteImageSize: (["small", "medium", "large"] as const)[index],
        infiniteMovement: (["slow", "normal", "fast"] as const)[index],
        infiniteShowControls: index !== 0,
        infiniteEnableKeyboard: index !== 2,
        infiniteBackgroundColor: ["#f7f2ea", "#f4f1ea", "#111827"][index],
        infiniteFogColor: ["#f7f2ea", "#f4f1ea", "#111827"][index],
      }),
      photoStart: 6 + index * 11,
      photoCount: 22,
    })),
    ...(["compact", "normal", "wide"] as const).map((density, index) => ({
      id: `${BASE}-gallery-palmer-${density}`,
      slug: `demo-gallery-palmer-${density}`,
      title: `Palmer Draggable ${density}`,
      subtitle: "Drag-friendly product-style grid",
      description: `Palmer draggable layout with density ${density}, item size, details, and custom colors.`,
      gridType: grid("palmer-draggable"),
      config: galleryConfig({
        palmerDensity: density,
        palmerItemSize: (["small", "medium", "large"] as const)[index],
        palmerShowDetails: index !== 0,
        palmerUseCustomColors: index === 2,
        palmerBackgroundColor: index === 2 ? "#161616" : "#f1f1f1",
        palmerTextColor: index === 2 ? "#f8f3df" : "#313131",
      }),
      photoStart: 10 + index * 13,
      photoCount: 20,
    })),
    ...(["auto", "headline", "alt", "caption"] as const).map((labelSource, index) => ({
      id: `${BASE}-gallery-sliphover-${labelSource}`,
      slug: `demo-gallery-sliphover-${labelSource}`,
      title: `Sliphover ${labelSource}`,
      subtitle: "Reference hover label system",
      description: `Tora sliphover grid using ${labelSource} labels with background and color options.`,
      gridType: grid("tora-sliphover"),
      config: galleryConfig({
        toraSliphoverUseBackground: index !== 2,
        toraSliphoverBackgroundColor: index === 1 ? "#252626" : "#f3eadb",
        toraSliphoverLabelSource: labelSource,
        toraSliphoverLabelBackgroundColor: index === 1 ? "#edd8aa" : "#111111",
        toraSliphoverLabelTextColor: index === 1 ? "#111111" : "#f8f3df",
      }),
      photoStart: 12 + index * 8,
      photoCount: 18,
    })),
    ...(["auto", "headline", "alt", "caption"] as const).map((titleSource, index) => ({
      id: `${BASE}-gallery-tora-justified-${titleSource}`,
      slug: `demo-gallery-tora-justified-${titleSource}`,
      title: `Tora Justified ${titleSource}`,
      subtitle: "Full-width justified showcase",
      description: `Tora justified showcase using ${titleSource} titles plus accent, dimming, gutters, and side-fill options.`,
      gridType: grid("tora-justified-showcase"),
      config: galleryConfig({
        toraJustifiedUseBackground: index !== 3,
        toraJustifiedBackgroundColor: index === 2 ? "#f7f2ea" : "#252626",
        toraJustifiedTitleColor: index === 2 ? "#252626" : "#f7f7f7",
        toraJustifiedAccentColor: index === 2 ? "#9c6b35" : "#edd8aa",
        toraJustifiedTitleSource: titleSource,
        toraJustifiedRowHeightFactor: 6 + index,
        toraJustifiedDesktopGutter: [12, 25, 40, 8][index],
        toraJustifiedMobileGutter: [8, 15, 22, 6][index],
        toraJustifiedHoverInset: index !== 3,
        toraJustifiedDimOnLeadHover: index !== 1,
        toraJustifiedShowBlurredSideFill: index !== 2,
      }),
      photoStart: 18 + index * 9,
      photoCount: 22,
    })),
    {
      id: `${BASE}-gallery-alternative-dark`,
      slug: "demo-gallery-alternative-dark",
      title: "Alternative Scroll Dark",
      subtitle: "Column scroll reference",
      description:
        "Alternative column scroll with text enabled and a dark studio palette.",
      gridType: grid("alternative-scroll"),
      config: galleryConfig({
        altUseBackground: true,
        altBackgroundColor: "#252626",
        altTextColor: "#f8f3df",
        altShowText: true,
      }),
      photoStart: 36,
      photoCount: 20,
    },
    {
      id: `${BASE}-gallery-alternative-plain`,
      slug: "demo-gallery-alternative-plain",
      title: "Alternative Scroll Plain",
      subtitle: "Image-first column scroll",
      description: "Alternative column scroll with background and text disabled.",
      gridType: grid("alternative-scroll"),
      config: galleryConfig({ altUseBackground: false, altShowText: false }),
      photoStart: 52,
      photoCount: 20,
    },
    {
      id: `${BASE}-gallery-proofing`,
      slug: "demo-gallery-client-proofing",
      title: "Client Proofing Demo",
      subtitle: "Private gallery share link",
      description:
        "A private proofing gallery with favorites and downloads enabled for demo review.",
      gridType: grid("justified"),
      spacing: "normal",
      photoStart: 60,
      photoCount: 18,
      visibility: "private",
      clientId: DEMO_CLIENT_ID,
      downloadEnabled: true,
    },
  ];

  const galleryPageConfigIds = demoGalleries.map((item) => `${item.id}-config`);
  const designConfigs: DemoPageConfig[] = [
    {
      id: `${BASE}-config-home-editorial`,
      scope: "home",
      gridType: "masonry",
      spacing: "airy",
      theme: "auto",
      hero: {
        enabled: true,
        headline: "Feature Demo Home",
        photoId: pick(0),
        overlay: 0.28,
      },
      config: galleryConfig({ hlOverlay: "editorial" }),
    },
    {
      id: `${BASE}-config-about-uniform`,
      scope: "about",
      gridType: "uniform",
      spacing: "normal",
      theme: "auto",
      hero: {
        enabled: true,
        headline: "Feature Demo About",
        photoId: pick(2),
        overlay: 0.2,
      },
      config: galleryConfig(),
    },
    {
      id: `${BASE}-config-category-tora-justified`,
      scope: "category",
      gridType: "tora-justified-showcase",
      spacing: "normal",
      theme: "dark",
      hero: {
        enabled: true,
        headline: "Feature Demo Category",
        photoId: pick(4),
        overlay: 0.35,
      },
      config: galleryConfig({
        toraJustifiedAccentColor: "#d8c98d",
        toraJustifiedDimOnLeadHover: false,
        toraJustifiedShowBlurredSideFill: false,
      }),
    },
    {
      id: `${BASE}-config-location-map-story`,
      scope: "location",
      gridType: "horizontal-lenis",
      spacing: "normal",
      theme: "auto",
      hero: {
        enabled: true,
        headline: "Feature Demo Location",
        photoId: pick(6),
        overlay: 0.24,
      },
      config: galleryConfig({ hlOverlay: "centered" }),
    },
    {
      id: `${BASE}-config-global-login-footer`,
      scope: "global",
      gridType: null,
      spacing: "normal",
      theme: "auto",
      hero: null,
      config: {
        login: {
          layout: "split-photo",
          headline: "Studio Admin",
          subtitle: "A polished split-photo login design for the feature demo set.",
          showBrand: true,
          showIconRow: true,
          backgroundMode: "soft-gradient",
          backgroundColor: "#f8fafc",
          gradientFrom: "#111827",
          gradientTo: "#b98546",
          cardAccent: "#b98546",
          hoverColor: "#f3c98b",
          hoverGlowSize: 46,
          hoverGlowIntensity: 28,
          primaryLabel: "Sign in",
          passkeyLabel: "Use passkey",
          photoId: pick(8),
          photoUrl: "",
          photoAlt: "Studio login preview",
          photoSide: "left",
          photoFocalX: 50,
          photoFocalY: 50,
          photoWidth: 50,
          showPhotoOnMobile: true,
        },
        footer: {
          layout: "sticky",
          text: "Feature demo pages for editorial photography, proofing, print sales, and location storytelling.",
          instagramLimit: 6,
          showSocial: true,
          stickyBackgroundColor: "#08090d",
          stickyTextColor: "#f8fafc",
          stickyAccentColor: "#d8c98d",
          stickyLargeText: true,
          stickyRevealStrength: "standard",
          stickyColumns: [
            {
              id: "feature-demo-pages",
              label: "Pages",
              links: [
                {
                  id: "feature-demo-home",
                  label: "Demo hub",
                  href: "/demo-features",
                  openInNewTab: false,
                },
                {
                  id: "feature-demo-pricing",
                  label: "Pricing",
                  href: "/demo-pricing-styles",
                  openInNewTab: false,
                },
                {
                  id: "feature-demo-contact",
                  label: "Contact",
                  href: "/demo-contact-styles",
                  openInNewTab: false,
                },
              ],
            },
            {
              id: "feature-demo-taxonomy",
              label: "Collections",
              links: [
                {
                  id: "feature-demo-categories",
                  label: "Categories",
                  href: "/categories/demo-editorial-portraits",
                  openInNewTab: false,
                },
                {
                  id: "feature-demo-locations",
                  label: "Locations",
                  href: "/locations/demo-chicago-studio",
                  openInNewTab: false,
                },
                {
                  id: "feature-demo-galleries",
                  label: "Galleries",
                  href: "/galleries/demo-gallery-masonry",
                  openInNewTab: false,
                },
              ],
            },
          ],
        },
      },
    },
  ];

  const pageConfigs: DemoPageConfig[] = [
    ...designConfigs,
    ...demoGalleries.map((item, index) => ({
      id: galleryPageConfigIds[index],
      scope: "gallery" as const,
      gridType: item.gridType,
      spacing: item.spacing ?? "normal",
      theme: item.theme ?? "auto",
      hero: { enabled: false },
      config: galleryConfig(item.config ?? {}),
    })),
  ];

  const categoryBySlug = new Map(demoCategories.map((item) => [item.slug, item]));
  const locationBySlug = new Map(demoLocations.map((item) => [item.slug, item]));
  const galleryBySlug = new Map(demoGalleries.map((item) => [item.slug, item]));

  const portfolioItems = (
    start: number,
    count: number,
    baseHref = "/demo-gallery-block-grids",
  ) =>
    Array.from({ length: count }, (_, index) => ({
      id: `portfolio-${start}-${index}`,
      title: [
        "Portrait Archive",
        "Ceremony Field Notes",
        "Open Air Studies",
        "Product Color Story",
        "Studio Details",
      ][index % 5],
      category: ["Portrait", "Event", "Nature", "Commercial", "Wedding"][index % 5],
      description:
        "A publish-ready project teaser using real gallery links, hover imagery, and editorial copy.",
      linkLabel: "View story",
      linkHref:
        index % 2 === 0
          ? baseHref
          : `/galleries/${demoGalleries[index % demoGalleries.length].slug}`,
      photoId: pick(start + index),
      hoverPhotoId: pick(start + index + 12),
    }));

  const testimonialItems = group(20, 5).map((photoId, index) => ({
    id: `testimonial-${index}`,
    name: ["Mara Chen", "Ari and Jules", "Nolan Reed", "The Elm House", "Sofia Lane"][
      index
    ],
    affiliation: [
      "Portrait client",
      "Wedding clients",
      "Brand director",
      "Venue partner",
      "Print collector",
    ][index],
    quote: [
      "The final gallery felt calm, generous, and deeply personal.",
      "Every important detail was handled without the day ever feeling interrupted.",
      "The campaign images were organized, fast to review, and easy for our whole team to use.",
      "The location story gave our venue a visual language we can actually publish.",
      "The print shop made the final selection feel simple and considered.",
    ][index],
    photoId,
  }));

  const teamMembers = group(28, 6).map((photoId, index) => ({
    id: `team-${index}`,
    name: [
      "Tora Miles",
      "June Park",
      "Elliot Ray",
      "Mina Vale",
      "Ravi Stone",
      "Lena Cross",
    ][index],
    role: ["Photographer", "Producer", "Editor", "Stylist", "Lighting", "Client care"][
      index
    ],
    description:
      "A concise team profile for studio pages, proofing support, and campaign production.",
    photoId,
    twitterUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    instagramUrl: "https://instagram.com",
    behanceUrl: "",
  }));

  const pricingFeatures = [
    "Planning call",
    "Online proofing",
    "Retouching",
    "Print-ready files",
  ].map((text, index) => ({
    id: `pricing-feature-${index}`,
    text,
    tooltip: "",
    included: true,
  }));
  const pricingPlans = ["Mini Session", "Editorial Day", "Campaign Week"].map(
    (name, index) => ({
      id: `plan-${index}`,
      name,
      info: [
        "A focused portrait or detail set",
        "A full-day narrative shoot",
        "Multi-day production and delivery",
      ][index],
      photoId: pick(40 + index),
      mediaPhotoId: pick(46 + index),
      mediaVideoUrl: "",
      monthlyPrice: [450, 1800, 4200][index],
      yearlyPrice: [5000, 19800, 46200][index],
      priceLabel: index === 2 ? "starting at" : "",
      highlighted: index === 1,
      ctaLabel: "Inquire",
      ctaHref: "/demo-contact-styles",
      features: pricingFeatures,
    }),
  );

  const faqItems = [
    {
      q: "Can the demos be copied into real pages?",
      a: "Yes. Each block uses normal page-builder data and can be duplicated or edited from the admin.",
    },
    {
      q: "Do the demos support light and dark mode?",
      a: "The pages use auto, light, and dark theme settings across the set to exercise both modes.",
    },
    {
      q: "Are private galleries represented?",
      a: "Yes. The seed creates a private proofing gallery and prints a fresh share link after each run.",
    },
    {
      q: "Do mobile layouts get covered?",
      a: "The seeded blocks use responsive controls, mobile spacing, and mobile-friendly gallery variants.",
    },
  ];

  const contactItems = [
    {
      id: "studio",
      title: "STUDIO",
      address: "231 Main Street Chicago, IL",
      phone: "+1 312 229 9000",
      href: "tel:+13122299000",
    },
    {
      id: "production",
      title: "PRODUCTION",
      address: "93 W Division Street Chicago, IL",
      phone: "+1 312 943 0367",
      href: "tel:+13129430367",
    },
  ];

  const pages: DemoPage[] = [];

  {
    const id = idFactory("demo-hub");
    pages.push({
      id: `${BASE}-page-hub`,
      slug: "demo-features",
      title: "Feature Demo Hub",
      type: "landing",
      theme: "auto",
      seoDescription:
        "A publish-ready hub linking to feature demo pages, galleries, categories, and locations.",
      blocks: [
        ...pageIntro(
          id,
          "FEATURE DEMOS",
          "A complete photography site demo library",
          "Browse polished pages, public gallery layouts, taxonomy examples, contact flows, proofing, pricing, and store sections.",
          pick(0),
        ),
        customLinkBlock(id(), "link-row", [
          {
            title: "Hero Systems",
            subtitle: "Banner layouts and effects",
            href: "/demo-hero-banner-layouts",
          },
          {
            title: "Gallery Blocks",
            subtitle: "Page-builder gallery grids",
            href: "/demo-gallery-block-grids",
          },
          {
            title: "Gallery Layouts",
            subtitle: "Public gallery renderer demos",
            href: "/galleries/demo-gallery-masonry",
          },
          {
            title: "Pricing",
            subtitle: "Service and plan styles",
            href: "/demo-pricing-styles",
          },
        ]),
        {
          id: id(),
          type: "columns",
          gap: "airy",
          justify: "fill",
          colAlign: ["top", "top", "top"],
          columns: [
            [
              {
                id: id(),
                type: "heading",
                text: "Pages",
                level: 3,
                align: "left",
                font: "sans",
                spacing: "normal",
                headingStyle: "tora-simple",
              },
              rich(
                id(),
                "The Pages tab is represented by dedicated, publish-ready pages that exercise every block type and style family.",
                "base",
              ),
            ],
            [
              {
                id: id(),
                type: "heading",
                text: "Galleries",
                level: 3,
                align: "left",
                font: "sans",
                spacing: "normal",
                headingStyle: "tora-simple",
              },
              rich(
                id(),
                "The Galleries tab is represented by public demo galleries for each layout and variant family.",
                "base",
              ),
            ],
            [
              {
                id: id(),
                type: "heading",
                text: "Taxonomy",
                level: 3,
                align: "left",
                font: "sans",
                spacing: "normal",
                headingStyle: "tora-simple",
              },
              rich(
                id(),
                "Demo categories and locations include cover photos, memberships, ordering, map coordinates, and publishable copy.",
                "base",
              ),
            ],
          ],
        },
        { id: id(), type: "categoryIndex", title: "Demo categories" },
        { id: id(), type: "locationIndex", title: "Demo locations" },
        customLinkBlock(
          id(),
          "link-row",
          pageSlugs.slice(1).map((slug) => ({
            title: slug.replace("demo-", "").replace(/-/g, " "),
            subtitle: "Feature page",
            href: `/${slug}`,
          })),
        ),
        {
          id: id(),
          type: "cta",
          headline: "Start with any section",
          body: "Every page is seeded as a normal published page and can be edited in Admin -> Pages.",
          buttonLabel: "Open gallery grid demos",
          buttonHref: "/demo-gallery-block-grids",
          buttonStyle: "pill",
        },
      ],
    });
  }

  {
    const id = idFactory("demo-hero");
    const bannerLayouts = [
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
      "toramochie-wedding-studio",
      "toramochie-minimal-slider",
      "toramochie-full-width-slider",
    ];
    const effects = [
      "none",
      "ken-burns",
      "reveal",
      "css-glitch-1",
      "css-glitch-2",
      "webgl-distortion",
    ];
    pages.push({
      id: `${BASE}-page-hero`,
      slug: "demo-hero-banner-layouts",
      title: "Editorial Hero Systems",
      type: "landing",
      theme: "auto",
      seoDescription:
        "A full photography hero layout demo with every banner layout, overlay, slider, and effect.",
      blocks: [
        ...pageIntro(
          id,
          "HERO SYSTEMS",
          "Editorial hero systems",
          "A campaign-style page exercising every banner layout, slider option, overlay mode, and motion effect.",
          pick(4),
        ),
        ...bannerLayouts.flatMap((layout, index) => [
          {
            id: id(),
            type: "banner",
            ...BANNER_DEFAULTS,
            photoId: pick(index + 5),
            photoIds: group(index + 5, 5),
            slides: sliderSlides(index + 5, 4, `hero-${index}`),
            layout,
            height: index % 5 === 0 ? "full" : index % 3 === 0 ? "short" : "tall",
            overlay: index % 4 === 0 ? "none" : index % 2 === 0 ? "dark" : "auto",
            headline: layout.replace(/-/g, " "),
            subhead:
              "A publishable hero treatment with tuned image, copy, overlay, and responsive composition.",
            eyebrow: "CAMPAIGN HERO",
            ctaLabel: "View gallery",
            ctaHref: `/galleries/${demoGalleries[index % demoGalleries.length].slug}`,
            effect: effects[index % effects.length],
            headlineFont: index % 2 === 0 ? "serif" : "sans",
            headlineSize: index % 4 === 0 ? "xl" : "lg",
            headlineTracking: index % 3 === 0 ? "wide" : "normal",
            headlineCase: index % 3 === 0 ? "upper" : "normal",
            buttonStyle: (["solid", "outline", "link", "pill"] as const)[index % 4],
            minimalSliderAutoplay: layout === "toramochie-minimal-slider",
            minimalSliderAutoplayMs: 4200,
            fullWidthSliderAccentColor: index % 2 === 0 ? "#f7f7f7" : "#d8c98d",
            fullWidthSliderDimImages: index % 2 === 0,
            prismaShowAsterisk: index % 2 === 0,
            agencyAccentText: "STUDIO",
          },
          divider(id(), layout.replace(/-/g, " ")),
        ]),
      ],
    });
  }

  {
    const id = idFactory("demo-content");
    pages.push({
      id: `${BASE}-page-content`,
      slug: "demo-content-typography",
      title: "Content and Type Studies",
      type: "standard",
      theme: "auto",
      seoDescription:
        "Typography, text, headings, columns, dividers, spacers, images, quotes, and links.",
      blocks: [
        ...pageIntro(
          id,
          "CONTENT",
          "Content and type studies",
          "A page that demonstrates text scale, heading styles, columns, dividers, spacers, image framing, quotes, and link treatments.",
          pick(10),
        ),
        ...(
          [
            "default",
            "tora-modern",
            "tora-modern-link",
            "tora-classic",
            "tora-creative",
            "tora-simple",
            "tora-urban",
          ] as const
        ).map((headingStyle, index) => ({
          id: id(),
          type: "heading",
          text: `${headingStyle.replace(/-/g, " ")} heading`,
          level: (index % 3) + 1,
          align: (["left", "center", "right"] as const)[index % 3],
          font: (
            ["sans", "serif", "playfair", "cormorant", "montserrat", "grotesk"] as const
          )[index % 6],
          spacing: (["tight", "normal", "airy"] as const)[index % 3],
          headingStyle,
          label: "TYPE STUDY",
          body: "Every heading style stays editable from the page builder.",
          linkHref: "/demo-features",
          ctaLabel: "Explore",
          ctaHref: "/demo-features",
          markText: "T",
        })),
        {
          id: id(),
          type: "subheading",
          text: "Subheading with centered alignment and Cormorant styling.",
          align: "center",
          font: "cormorant",
          spacing: "normal",
        },
        ...(["sm", "base", "lg", "xl"] as const).map((size) =>
          rich(
            id(),
            `Rich text size ${size}. This block uses plain text, paragraph spacing, and responsive measure for readable editorial copy.`,
            size,
          ),
        ),
        {
          id: id(),
          type: "columns",
          gap: "airy",
          justify: "spread",
          colAlign: ["top", "center", "bottom"],
          columns: [
            [
              {
                id: id(),
                type: "image",
                photoId: pick(12),
                width: "normal",
                rounded: true,
                caption: "Normal rounded image",
              },
            ],
            [
              {
                id: id(),
                type: "image",
                photoId: pick(13),
                width: "wide",
                rounded: false,
                caption: "Wide square-edged image",
              },
            ],
            [
              {
                id: id(),
                type: "quote",
                text: "A clean content page should feel considered before any special effect appears.",
                cite: "Feature Demo",
              },
            ],
          ],
        },
        ...(["solid", "dashed", "dotted", "double", "fade", "gradient"] as const).map(
          (style, index) => ({
            id: id(),
            type: "divider",
            style,
            thickness: (["hairline", "thin", "medium", "thick"] as const)[index % 4],
            width: (["full", "content", "narrow"] as const)[index % 3],
            align: (["left", "center", "right"] as const)[index % 3],
            spacing: index % 2 === 0 ? "normal" : "custom",
            customSpacingTop: 24 + index * 4,
            customSpacingBottom: 24 + index * 4,
            colorMode: index % 2 === 0 ? "foreground" : "custom",
            color: "#9c6b35",
            backgroundMode: index === 5 ? "muted" : "none",
            backgroundColor: "#f4f4f5",
            label: style,
          }),
        ),
        ...(["xs", "sm", "md", "lg", "xl", "custom"] as const).map((size, index) => ({
          id: id(),
          type: "spacer",
          size,
          mobileSize: index % 2 === 0 ? "same" : "sm",
          customHeight: 80 + index * 20,
          mobileCustomHeight: 48 + index * 10,
          backgroundMode: index === 5 ? "custom" : index === 3 ? "muted" : "none",
          backgroundColor: "#f2ebe1",
          backgroundWidth: index % 2 === 0 ? "full" : "content",
        })),
        customLinkBlock(id(), "link-row", [
          {
            title: "Portfolio",
            subtitle: "Project links",
            href: "/demo-portfolio-list-styles",
          },
          { title: "Contact", subtitle: "Inquiry links", href: "/demo-contact-styles" },
          { title: "Pricing", subtitle: "Service links", href: "/demo-pricing-styles" },
        ]),
        customLinkBlock(id(), "center-button", [
          { title: "Back to hub", subtitle: "Feature demos", href: "/demo-features" },
        ]),
      ],
    });
  }

  {
    const id = idFactory("demo-info");
    const creativeRatios = ["auto", "4-5", "1-1", "16-9", "3-2", "2-3"] as const;
    const infoBlocks = [
      {
        style: "creative",
        title: "Creative split",
        creativeTextLayout: "split",
        creativePhotoSize: "50",
        dimPhoto: true,
      },
      {
        style: "creative",
        title: "Creative reference",
        creativeTextLayout: "reference",
        creativePhotoSize: "70",
        dimPhoto: false,
      },
      { style: "simpleText", title: "Simple text" },
      { style: "quote", title: "Statement quote" },
      {
        style: "infoList",
        title: "Info list left",
        infoListTextPosition: "left",
        dimPhoto: true,
      },
      {
        style: "infoList",
        title: "Info list centered",
        infoListTextPosition: "center",
        dimPhoto: false,
      },
      { style: "classic", title: "Classic information" },
      { style: "tabs", title: "Tabbed services" },
      { style: "textStyle", title: "Text style" },
      { style: "accordion", title: "Accordion details" },
      { style: "simple", title: "Simple image note" },
      { style: "modern", title: "Modern image note" },
    ];
    pages.push({
      id: `${BASE}-page-info`,
      slug: "demo-info-block-styles",
      title: "Reference Info Blocks",
      type: "standard",
      theme: "auto",
      seoDescription:
        "All info block styles with creative text layout, photo size, ratio, dimming, tabs, and accordions.",
      blocks: [
        ...pageIntro(
          id,
          "INFO BLOCKS",
          "Reference info blocks",
          "A services page that exercises every info block style, including the reference text positions, photo sizing, aspect ratios, and dim controls.",
          pick(18),
        ),
        ...infoBlocks.map((item, index) => ({
          id: id(),
          type: "infoBlock",
          style: item.style,
          eyebrow: "STUDIO NOTE",
          title: item.title,
          text: "A practical detail section for services, production notes, travel planning, wardrobe guidance, or delivery expectations.",
          quote:
            "Small details make a session feel composed before the first frame is made.",
          photoId: pick(18 + index),
          secondaryPhotoId: pick(30 + index),
          dimPhoto: item.dimPhoto ?? index % 2 === 0,
          creativeTextLayout: item.creativeTextLayout ?? "split",
          creativePhotoSize:
            item.creativePhotoSize ?? (["50", "60", "70"] as const)[index % 3],
          creativePhotoRatio: creativeRatios[index % creativeRatios.length],
          infoListTextPosition: item.infoListTextPosition ?? "left",
          buttonLabel: "Inquire",
          buttonHref: "/demo-contact-styles",
          tabs: ["Commercial", "Editorial", "Wedding"].map((title, tabIndex) => ({
            id: `${item.style}-tab-${tabIndex}`,
            title,
            text: "A focused service note with a supporting image and accent frame.",
            photoId: pick(35 + tabIndex + index),
            accentPhotoId: pick(45 + tabIndex + index),
          })),
          accordionItems: ["Planning", "Shoot day", "Delivery"].map(
            (title, accordionIndex) => ({
              id: `${item.style}-accordion-${accordionIndex}`,
              title,
              text: "Clear expectations, simple production flow, and polished delivery for real clients.",
            }),
          ),
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-portfolio");
    const styles = [
      "modern",
      "category-cards",
      "distortion",
      "animated-masonry",
      "mix-masonry",
      "tora-progress-slider",
      "tora-parallax-showcase",
      "tora-full-showcase-slider",
      "tora-models-masonry",
      "tora-wedding-stories",
    ] as const;
    pages.push({
      id: `${BASE}-page-portfolio`,
      slug: "demo-portfolio-list-styles",
      title: "Portfolio Story Systems",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Portfolio list styles including Tora progress slider, parallax showcase, full showcase, models, and wedding stories.",
      blocks: [
        ...pageIntro(
          id,
          "PORTFOLIO",
          "Portfolio story systems",
          "Project index styles that can stand alone as collection pages, campaign pages, or service landing pages.",
          pick(24),
        ),
        ...styles.map((style, index) => ({
          id: id(),
          type: "portfolioList",
          style,
          eyebrow: "SELECTED WORK",
          title: style.replace(/-/g, " "),
          body: "Each item links into a seeded public gallery or supporting demo page.",
          items: portfolioItems(index * 3, 5),
          backgroundColor: index % 2 === 0 ? "#242625" : "#f3eadb",
          textColor: index % 2 === 0 ? "#f8f3df" : "#252626",
          accentColor: index % 2 === 0 ? "#d8c98d" : "#9c6b35",
          showBackground: index !== 1,
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-about");
    const layouts = [
      "simple",
      "modern",
      "classic",
      "tora-casting",
      "tora-about-me",
    ] as const;
    pages.push({
      id: `${BASE}-page-about`,
      slug: "demo-about-profile-styles",
      title: "Studio Profile Layouts",
      type: "about",
      theme: "auto",
      seoDescription:
        "About block layouts for studio profile, casting, classic bio, modern intro, and about-me pages.",
      blocks: [
        ...pageIntro(
          id,
          "ABOUT",
          "Studio profile layouts",
          "A profile page suite covering all About block layouts with contact, press, awards, collaborators, and form options.",
          pick(32),
        ),
        ...layouts.map((layout, index) => ({
          id: id(),
          type: "about",
          layout,
          sectionEyebrow: "ABOUT",
          sectionTitle: layout.replace(/-/g, " "),
          eyebrow: "PHOTOGRAPHER",
          headline: [
            "A considered portrait studio",
            "Images with quiet direction",
            "Classic service, modern delivery",
            "Casting and production support",
            "A personal studio note",
          ][index],
          body: "We build calm, organized sessions for clients who need publish-ready imagery, polished proofing, and clear delivery.",
          quote: "Direction should feel useful, not heavy.",
          ctaLabel: "Start a session",
          ctaHref: "/demo-contact-styles",
          primaryPhotoId: pick(32 + index),
          secondaryPhotoId: pick(38 + index),
          tertiaryPhotoId: pick(44 + index),
          contactTitle: "CONTACT",
          address: "231 Main Street Chicago, IL",
          phoneLabel: "Ph:",
          phoneNumber: "3122299000",
          facebookUrl: "",
          twitterUrl: "",
          instagramUrl: "https://instagram.com",
          pressTitle: "PRESS",
          pressLinks: [
            { id: `${layout}-press-1`, label: "Editorial Review", href: "#" },
            { id: `${layout}-press-2`, label: "Studio Notes", href: "#" },
          ],
          awardsTitle: "AWARDS",
          awardLinks: [
            { id: `${layout}-award-1`, label: "Portrait Series", href: "#" },
            { id: `${layout}-award-2`, label: "Campaign Shortlist", href: "#" },
          ],
          collaboratorsTitle: "COLLABORATORS",
          collaboratorsText:
            "Design teams, planners, agencies, venues, families, and independent makers.",
          showContactForm: index % 2 === 0,
          contactFormTitle: "CONTACT ME",
          submitLabel: "Send note",
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-media");
    pages.push({
      id: `${BASE}-page-media`,
      slug: "demo-media-interaction-tools",
      title: "Interactive Media Tools",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Image comparison, feature carousel, book slider, gallery effects, and interactive media blocks.",
      blocks: [
        ...pageIntro(
          id,
          "MEDIA",
          "Interactive media tools",
          "Proofing, comparison, carousel, lookbook, and cinematic gallery tools for image-heavy stories.",
          pick(40),
        ),
        ...(["horizontal", "vertical"] as const).flatMap(
          (orientation, orientationIndex) =>
            (
              [
                "16-9",
                "3-2",
                "4-3",
                "square",
                "4-5",
                "portrait",
                "3-4",
                "2-3",
                "9-16",
              ] as const
            ).map((aspectRatio, index) => ({
              id: id(),
              type: "imageComparison",
              title: `${orientation} ${aspectRatio} comparison`,
              subtitle:
                "Drag the handle to review crop, color, retouching, or delivery choices.",
              leftPhotoId: pick(40 + index + orientationIndex),
              rightPhotoId: pick(52 + index + orientationIndex),
              leftLabel: "Before",
              rightLabel: "After",
              comparisonOrientation: orientation,
              initialPosition: 45 + (index % 3) * 5,
              aspectRatio,
              width: (["normal", "wide", "full"] as const)[index % 3],
              rounded: index % 2 === 0,
              showcaseBackground: index % 3 !== 0,
              backgroundColor: "#f4f4f5",
              handleColor: "#ffffff",
            })),
        ),
        ...(["3", "5", "7"] as const).map((desktopVisibleCount, index) => ({
          id: id(),
          type: "featureCarousel",
          headline: "Field notes in motion",
          highlightText: "motion",
          highlightFrom: "#b98546",
          highlightTo: "#111827",
          subtitle:
            "A responsive feature carousel for phone-first or campaign feature sections.",
          photoIds: group(46 + index * 5, 8),
          autoplay: index !== 0,
          autoplayMs: 3500 + index * 900,
          showArrows: index !== 2,
          desktopVisibleCount,
          imageRadius: (["lg", "xl", "full"] as const)[index],
          primaryLabel: "Open gallery",
          primaryHref: `/galleries/${demoGalleries[index].slug}`,
          secondaryLabel: "Contact",
          secondaryHref: "/demo-contact-styles",
        })),
        ...(["compact", "standard", "large"] as const).map((size, index) => ({
          id: id(),
          type: "bookSlider",
          title: `${size} studio lookbook`,
          subtitle: "Click or drag pages to browse a session as a book.",
          coverTitle: "Lookbook",
          coverSubtitle: "A curated proofing story",
          coverPhotoId: pick(54 + index),
          pages: group(55 + index * 4, 5).map((photoId, pageIndex) => ({
            id: `${size}-book-page-${pageIndex}`,
            photoId,
            imageMode: pageIndex % 2 === 0 ? "editorial" : "full",
            headline: ["Arrival", "Portrait", "Details", "Motion", "Close"][pageIndex],
            subhead: "A compact editorial spread for publish-ready storytelling.",
            caption: "Demo page",
            linkLabel: "View",
            linkHref: "/demo-features",
          })),
          size,
          pageStyle: index % 2 === 0 ? "soft" : "hard",
          paperTexture: index !== 2,
          showcaseBackground: index !== 1,
          showControls: true,
          showPageNumbers: index !== 0,
          shadowStrength: 0.35 + index * 0.18,
          backgroundColor: "#f7f1e8",
          textColor: "#2d251d",
          accentColor: "#8b5e34",
        })),
        {
          id: id(),
          type: "heading",
          text: "Gallery effects",
          level: 2,
          align: "center",
          font: "playfair",
          spacing: "airy",
          headingStyle: "tora-modern",
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          gridType: "justified",
          limit: 10,
          effect: "webgl-distortion",
          effectSpeed: 1,
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          gridType: "cinematic",
          limit: 12,
          effect: "none",
          effectSpeed: 0.8,
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          gridType: "justified",
          limit: 12,
          effect: "cinematic-3d-scroll",
          effectSpeed: 1.35,
        },
      ],
    });
  }

  {
    const id = idFactory("demo-gallery-blocks");
    const gridTypes = [
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
      "tora-justified-showcase",
    ] as const;
    pages.push({
      id: `${BASE}-page-gallery-blocks`,
      slug: "demo-gallery-block-grids",
      title: "Gallery Grid Systems",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Page-builder gallery grids, sources, spacing, autoplay, backdrop, props catalog, and Tora justified settings.",
      blocks: [
        ...pageIntro(
          id,
          "GALLERY BLOCKS",
          "Gallery grid systems",
          "Every Page Builder gallery grid type, source mode, spacing mode, carousel option, and Tora-specific control represented in one publishable index.",
          pick(48),
        ),
        ...gridTypes.map((gridType, index) => ({
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source:
            index % 4 === 0
              ? "category"
              : index % 4 === 1
                ? "location"
                : index % 4 === 2
                  ? "gallery"
                  : "featured",
          targetId:
            index % 4 === 0
              ? demoCategories[index % demoCategories.length].id
              : index % 4 === 1
                ? demoLocations[index % demoLocations.length].id
                : index % 4 === 2
                  ? demoGalleries[index % demoGalleries.length].id
                  : null,
          gridType,
          spacing: (["tight", "normal", "airy"] as const)[index % 3],
          autoplay: gridType === "carousel",
          backdrop: gridType === "carousel3d" ? "neutral" : "color",
          limit: gridType === "cinematic" ? 12 : 10,
          toraPropsShowBackground: index % 2 === 0,
          toraPropsBackgroundColor: "#252626",
          toraPropsCaptionColor: "#edd8aa",
          toraPropsShowCaptions: true,
          toraPropsCaptionSource: (["auto", "headline", "alt", "caption"] as const)[
            index % 4
          ],
          toraJustifiedUseBackground: index % 2 === 0,
          toraJustifiedBackgroundColor: index % 2 === 0 ? "#252626" : "#f7f2ea",
          toraJustifiedTitleColor: index % 2 === 0 ? "#f7f7f7" : "#252626",
          toraJustifiedAccentColor: index % 2 === 0 ? "#edd8aa" : "#9c6b35",
          toraJustifiedTitleSource: (["auto", "headline", "alt", "caption"] as const)[
            index % 4
          ],
          toraJustifiedRowHeightFactor: 5 + (index % 6),
          toraJustifiedDesktopGutter: 8 + index * 3,
          toraJustifiedMobileGutter: 6 + (index % 5) * 4,
          toraJustifiedHoverInset: index % 2 === 0,
          toraJustifiedDimOnLeadHover: index % 3 !== 0,
          toraJustifiedScrollOnSelect: true,
          toraJustifiedShowBlurredSideFill: index % 4 !== 0,
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-filter");
    const customPhotos = group(8, 18);
    pages.push({
      id: `${BASE}-page-filters`,
      slug: "demo-gallery-filter-systems",
      title: "Portfolio Filter Systems",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Category, location, and custom filter tabs with flip reveal and Tora portfolio masonry styles.",
      blocks: [
        ...pageIntro(
          id,
          "FILTERS",
          "Portfolio filter systems",
          "Category, location, and custom filters with sorting overrides, manual order, overlay text, pagination text sizing, and separator sizing.",
          pick(56),
        ),
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          filterMode: "category",
          filterStyle: "flip-reveal",
          showOverlayText: true,
          limit: 24,
          filterSorts: demoCategories.map((category, index) => ({
            key: category.id,
            sortMode: (
              ["source", "newest", "oldest", "title-asc", "title-desc"] as const
            )[index % 5],
            photoIds: group(category.photoStart, 8),
          })),
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          filterMode: "location",
          filterStyle: "tora-portfolio-masonry",
          showOverlayText: true,
          limit: 24,
          toraPortfolioFilterTextSize: 24,
          toraPortfolioSeparatorSize: 38,
          filterSorts: demoLocations.map((loc, index) => ({
            key: loc.id,
            sortMode: (
              ["source", "newest", "oldest", "title-asc", "title-desc"] as const
            )[index % 5],
            photoIds: group(loc.photoStart, 8),
          })),
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "featured",
          filterMode: "custom",
          filterStyle: "tora-portfolio-masonry",
          showOverlayText: false,
          limit: 24,
          sortMode: "custom",
          manualOrderPhotoIds: [...customPhotos].reverse(),
          toraPortfolioFilterTextSize: 38,
          toraPortfolioSeparatorSize: 74,
          customFilters: [
            {
              id: "custom-portraits",
              label: "Portraits",
              photoIds: customPhotos.slice(0, 8),
            },
            {
              id: "custom-places",
              label: "Places",
              photoIds: customPhotos.slice(5, 13),
            },
            {
              id: "custom-details",
              label: "Details",
              photoIds: customPhotos.slice(10, 18),
            },
          ],
          filterSorts: [
            {
              key: "custom-portraits",
              sortMode: "custom",
              photoIds: customPhotos.slice(0, 8).reverse(),
            },
            {
              key: "custom-places",
              sortMode: "title-asc",
              photoIds: customPhotos.slice(5, 13),
            },
            {
              key: "custom-details",
              sortMode: "oldest",
              photoIds: customPhotos.slice(10, 18),
            },
          ],
        },
      ],
    });
  }

  {
    const id = idFactory("demo-scroll-core");
    pages.push({
      id: `${BASE}-page-scroll-core`,
      slug: "demo-scroll-showcase-core",
      title: "Scroll Showcase Stories",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Core scroll showcase cinematic and 3D carousel styles using seeded categories.",
      blocks: [
        ...pageIntro(
          id,
          "SCROLL",
          "Scroll showcase stories",
          "Pinned category-led stories for cinematic panels and carousel-style scroll presentations.",
          pick(62),
        ),
        {
          id: id(),
          type: "scrollShowcase",
          title: "CINEMATIC",
          categoryIds: demoCategories.map((item) => item.id),
          limit: 5,
          clusterCount: 4,
          showTitles: true,
          style: "cinematic",
        },
        {
          id: id(),
          type: "scrollShowcase",
          title: "CAROUSEL",
          categoryIds: demoCategories.map((item) => item.id),
          limit: 5,
          clusterCount: 3,
          showTitles: true,
          style: "carousel3d",
        },
      ],
    });
  }

  {
    const id = idFactory("demo-scroll-panels");
    pages.push({
      id: `${BASE}-page-scroll-panels`,
      slug: "demo-scroll-panels-variants",
      title: "Scroll Panel Treatments",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Scroll panel variants: classic, scatter, demo4, perspective, zoom, and brightness.",
      blocks: [
        ...pageIntro(
          id,
          "SCROLL PANELS",
          "Scroll panel treatments",
          "Codrops-inspired scroll panel variants with intro counts, row counts, tone, alignment, color, and background controls.",
          pick(66),
        ),
        ...(
          ["classic", "scatter", "demo4", "perspective", "zoom", "brightness"] as const
        ).map((variant, index) => ({
          id: id(),
          type: "scrollShowcase",
          title: variant.toUpperCase(),
          categoryIds: demoCategories.map((item) => item.id),
          limit: 5,
          clusterCount: 4,
          showTitles: true,
          style: "scrollPanels",
          scrollPanelsVariant: variant,
          scrollPanelsIntroCount: 10 + index * 2,
          scrollPanelsRowCount: 3 + (index % 4),
          scrollPanelsTone: index % 2 === 0 ? "color" : "grayscale",
          scrollPanelsIntroAlign: (["left", "center", "right"] as const)[index % 3],
          scrollPanelsUseBackground: index !== 4,
          scrollPanelsBackground: index % 2 === 0 ? "#f4f0e8" : "#111111",
          scrollPanelsTextColor: index % 2 === 0 ? "#171717" : "#f8f3df",
          scrollPanelsIntroHeading: `${variant} panels`,
          scrollPanelsIntroText:
            "Scroll through collection panels, thumbnails, and editorial labels.",
          scrollPanelsShowcaseHeading: "Selected work",
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-formations");
    pages.push({
      id: `${BASE}-page-formations`,
      slug: "demo-layout-formation-variants",
      title: "Layout Formation Studies",
      type: "portfolio",
      theme: "auto",
      seoDescription:
        "Layout formation variants: rise, columns, zoomed, reveal, tilted, depth, and side pivot.",
      blocks: [
        ...pageIntro(
          id,
          "FORMATIONS",
          "Layout formation studies",
          "Pinned image assemblies that show each layout formation variant with header alignment and photo count controls.",
          pick(70),
        ),
        ...(
          [
            "rise",
            "columns",
            "zoomed",
            "reveal",
            "tilted",
            "depth",
            "sidePivot",
          ] as const
        ).map((variant, index) => ({
          id: id(),
          type: "scrollShowcase",
          title: variant.toUpperCase(),
          categoryIds: demoCategories.map((item) => item.id),
          limit: 5,
          clusterCount: 4,
          showTitles: true,
          style: "layoutFormations",
          layoutFormationsVariant: variant,
          layoutFormationsHeaderAlign: (["left", "center", "right"] as const)[
            index % 3
          ],
          layoutFormationsHeading: `${variant} formation`,
          layoutFormationsPhotoCount: 8 + index * 2,
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-scroll-layouts");
    pages.push({
      id: `${BASE}-page-scroll-layouts`,
      slug: "demo-scroll-layout-variants",
      title: "Scroll Layout Morphs",
      type: "portfolio",
      theme: "dark",
      seoDescription:
        "Scroll layout variants: row, breakout, grid10, stackDark, stackGlass, stackScale, tiny, bento, and single.",
      blocks: [
        ...pageIntro(
          id,
          "LAYOUT MORPHS",
          "Scroll layout morphs",
          "Pinned image layouts that move between editorial compositions and responsive image assemblies.",
          pick(74),
        ),
        ...(
          [
            "row",
            "breakout",
            "grid10",
            "stackDark",
            "stackGlass",
            "stackScale",
            "tiny",
            "bento",
            "single",
          ] as const
        ).map((variant, index) => ({
          id: id(),
          type: "scrollShowcase",
          title: variant.toUpperCase(),
          categoryIds: demoCategories.map((item) => item.id),
          limit: 5,
          clusterCount: 4,
          showTitles: true,
          style: "scrollLayouts",
          scrollLayoutsVariant: variant,
          scrollLayoutsHeading: `${variant} scroll layout`,
          scrollLayoutsIntroText:
            "A scroll-linked image layout for an editorial photography website.",
          scrollLayoutsPhotoCount:
            variant === "grid10" ? 10 : variant === "single" ? 1 : 9,
          scrollLayoutsCaption: "Feature demo layout",
          scrollLayoutsUseBackground: index !== 2,
          scrollLayoutsBackground: index % 2 === 0 ? "#131417" : "#f5efe6",
          scrollLayoutsTextColor: index % 2 === 0 ? "#ffffff" : "#171717",
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-proof");
    pages.push({
      id: `${BASE}-page-proof`,
      slug: "demo-proof-team-logos-faq",
      title: "Client Proofing and Studio Trust",
      type: "standard",
      theme: "auto",
      seoDescription:
        "Testimonials, team, logos, FAQ, proofing links, and client-facing trust sections.",
      blocks: [
        ...pageIntro(
          id,
          "PROOFING",
          "Client proofing and studio trust",
          "A client-facing page with testimonials, team layouts, logos, FAQ styles, and proofing gallery links.",
          pick(2),
        ),
        customLinkBlock(id(), "link-row", [
          {
            title: "Public gallery",
            subtitle: "Masonry demo",
            href: "/galleries/demo-gallery-masonry",
          },
          {
            title: "Private proofing",
            subtitle: "Share link prints after seed",
            href: "/demo-features",
          },
          {
            title: "Contact",
            subtitle: "Inquiry styles",
            href: "/demo-contact-styles",
          },
        ]),
        ...(
          [
            "slider",
            "portrait-grid",
            "retro-carousel",
            "glass-stack",
            "tora-gold-urban",
          ] as const
        ).map((layout, index) => ({
          id: id(),
          type: "testimonials",
          layout,
          label: "CLIENT NOTES",
          title: layout.replace(/-/g, " "),
          subtitle: "Realistic trust copy for a publishable photography website.",
          gridPanel: index % 2 === 0,
          gridColumns: index % 2 === 0 ? "3" : "2",
          glassShowcaseBackground: index !== 1,
          glassShowcaseBackgroundColor: "#0d1324",
          autoplay: index === 0 || index === 2,
          showThumbnails: index !== 3,
          items: testimonialItems,
        })),
        ...(
          [
            "showcase",
            "memberCards",
            "marqueeCards",
            "creativeSection",
            "orbitCarousel",
            "toraCrew",
          ] as const
        ).map((layout, index) => ({
          id: id(),
          type: "team",
          title: `${layout.replace(/([A-Z])/g, " $1")} team`,
          layout,
          cardPosition: (["alternate", "left", "right"] as const)[index % 3],
          showCardArrow: index % 2 === 0,
          creativeEyebrow: "O U R",
          creativeDescription:
            "Meet the people behind the images, edits, and client experience.",
          creativeLogo: "TORA",
          creativeColumns: index % 2 === 0 ? "3" : "4",
          creativeShowCardOutline: index !== 2,
          creativeCtaLabel: "REGISTER NOW",
          creativeCtaHref: "/demo-contact-styles",
          creativeShowMainSocials: true,
          creativeTwitterUrl: "#",
          creativeFacebookUrl: "#",
          creativeInstagramUrl: "#",
          creativeYoutubeUrl: "#",
          creativeWebsiteLabel: "studio.example",
          creativeWebsiteHref: "#",
          marqueeSubtitle: "Production support for editorial and private commissions.",
          marqueeSpeed: 26 + index * 4,
          marqueePauseOnHover: true,
          marqueeShowDecorations: index !== 0,
          marqueeShowQuote: true,
          marqueeQuote:
            "The care and communication made the entire experience feel effortless.",
          marqueeQuoteAuthor: "Natalia Kara",
          marqueeQuoteRole: "Studio client",
          marqueeQuotePhotoId: pick(74 + index),
          orbitSubtitle: "Select a team member from the orbit to learn more.",
          orbitRingCount: (["auto", "1", "2", "3"] as const)[index % 4],
          orbitAutoplay: index !== 4,
          orbitSpeed: 4200 + index * 600,
          orbitPauseOnHover: true,
          orbitShowDots: true,
          orbitShowIconAccents: true,
          orbitButtonLabel: "Connect",
          orbitButtonHref: "/demo-contact-styles",
          toraCrewEyebrow: "MEET US",
          toraCrewShowHiring: index % 2 === 0,
          toraCrewHiringTitle: "WE ARE BOOKING",
          toraCrewHiringHref: "/demo-contact-styles",
          toraCrewHiringLinks: [
            { id: "producer", title: "PRODUCER", subtitle: "CALL SHEET", href: "#" },
            { id: "stylist", title: "STYLIST", subtitle: "WARDROBE", href: "#" },
            { id: "assistant", title: "ASSISTANT", subtitle: "LIGHTING", href: "#" },
          ],
          grayscale: index % 2 === 0,
          showSocials: true,
          members: teamMembers,
        })),
        ...(["row", "grid", "marquee", "tora-client-wall"] as const).map(
          (style, index) => ({
            id: id(),
            type: "logos",
            title: `${style.replace(/-/g, " ")} client marks`,
            eyebrow: "BEST CASES",
            intro:
              "Logo and client-wall presentations can use selected images as marks or partner badges.",
            style,
            grayscale: index % 2 === 0,
            size: (["sm", "md", "lg"] as const)[index % 3],
            spacing: (["tighter", "tight", "normal", "airy"] as const)[index],
            photoIds: group(10 + index * 6, 8),
          }),
        ),
        ...(["accordion", "list", "cards", "bordered"] as const).map(
          (style, index) => ({
            id: id(),
            type: "faq",
            title: `${style} questions`,
            style,
            align: (["left", "center", "right"] as const)[index % 3],
            items: faqItems,
          }),
        ),
      ],
    });
  }

  {
    const id = idFactory("demo-pricing");
    const styles = [
      "standard",
      "glass-gradient",
      "tora-classic",
      "tora-creative",
      "tora-modern",
      "tora-simple",
      "tora-with-media",
      "tora-image-background",
      "tora-price-list-style-1",
      "tora-pricing-slider",
      "tora-price-list-style-3",
      "tora-casting-services",
    ] as const;
    pages.push({
      id: `${BASE}-page-pricing`,
      slug: "demo-pricing-styles",
      title: "Pricing Services",
      type: "standard",
      theme: "auto",
      seoDescription:
        "All pricing styles with billing frequency, themes, Tora slider sizing, media, and casting ratios.",
      blocks: [
        ...pageIntro(
          id,
          "PRICING",
          "Pricing services",
          "A service page covering every pricing layout, text size option, billing toggle, theme, media image, slider background, and casting image ratio.",
          pick(36),
        ),
        ...styles.map((style, index) => ({
          id: id(),
          type: "pricing",
          style,
          eyebrow: "SERVICES",
          heading: style.replace(/-/g, " "),
          description:
            "Publish-ready package copy for portraits, events, commercial libraries, and casting support.",
          currency: "$",
          defaultFrequency: index % 2 === 0 ? "monthly" : "yearly",
          showBillingToggle: index < 8,
          theme: (["auto", "dark", "light"] as const)[index % 3],
          showHighlightEffect: index % 2 === 0,
          pricingSliderBackgroundPhotoId: pick(50 + index),
          pricingSliderOverlayOpacity: 0.35 + (index % 4) * 0.1,
          pricingSliderHeadingSize: (
            ["small", "reference", "large", "oversized"] as const
          )[index % 4],
          pricingSliderEyebrowSize: (
            ["small", "reference", "large", "oversized"] as const
          )[(index + 1) % 4],
          pricingSliderAutoplay: index % 2 === 0,
          pricingSliderAutoplayMs: 4200 + index * 200,
          pricingSliderTransitionMs: 900 + index * 80,
          castingImageRatio: (
            ["reference", "wide", "landscape", "square", "portrait"] as const
          )[index % 5],
          plans: pricingPlans,
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-contact");
    const styles = [
      "stacked",
      "split",
      "card",
      "minimal",
      "tora-contact",
      "tora-contact-info",
      "tora-images-form",
      "tora-contacts-reference",
    ] as const;
    pages.push({
      id: `${BASE}-page-contact`,
      slug: "demo-contact-styles",
      title: "Contact Experiences",
      type: "contact",
      theme: "auto",
      seoDescription:
        "All contact form styles, Tora contact info, images with form, hero contact reference, and social links.",
      blocks: [
        ...pageIntro(
          id,
          "CONTACT",
          "Contact experiences",
          "Inquiry forms, office information, image-led contact layouts, reference contact treatment, and social links.",
          pick(42),
        ),
        ...styles.map((style, index) => ({
          id: id(),
          type: "contactForm",
          style,
          eyebrow: "CONTACT",
          heading: `${style.replace(/-/g, " ")} inquiry`,
          body: "Tell us about the session, location, timing, and delivery needs. We will reply with availability and next steps.",
          submitLabel: "Send inquiry",
          align: (["left", "center", "right"] as const)[index % 3],
          contactHeroPhotoId: pick(42 + index),
          contactHeroTitle: "CONTACTS",
          contactHeroOverlayOpacity: 0.35 + (index % 3) * 0.1,
          contactInfoEyebrow: "CONTACT",
          contactInfoHeading: "CONTACT INFO",
          contactInfoIntro:
            "For studio booking, licensing, or proofing support, choose the best contact below.",
          contactInfoItems: contactItems,
          contactImageEyebrow: "CONTACT",
          contactImageHeading: "IMAGES WITH FORM",
          contactSocialLinks: [
            { id: "facebook", label: "Facebook", href: "#" },
            { id: "instagram", label: "Instagram", href: "https://instagram.com" },
            { id: "email", label: "Email", href: "mailto:hello@example.com" },
          ],
          contactImagePhotoIds: group(44 + index * 3, index === 6 ? 6 : 5),
          contactSideCaption: "Designed for publish-ready contact pages.",
        })),
      ],
    });
  }

  {
    const id = idFactory("demo-commerce");
    pages.push({
      id: `${BASE}-page-commerce`,
      slug: "demo-commerce-conversion",
      title: "Print Shop and Calls to Action",
      type: "landing",
      theme: "auto",
      seoDescription:
        "Shop grid, coming soon shop, CTA styles, Instagram, and conversion-focused links.",
      blocks: [
        ...pageIntro(
          id,
          "SHOP",
          "Print shop and calls to action",
          "A conversion page for prints, digital products, promotions, CTAs, Instagram, and checkout-ready store sections.",
          pick(52),
        ),
        {
          id: id(),
          type: "shop",
          style: "tora-grid",
          title: productCount > 0 ? "SHOP PRINTS" : "SHOP PREVIEW",
          body:
            productCount > 0
              ? "Browse seeded print and digital product examples with filtering, sorting, prices, and sale labels."
              : "Run npm run seed:store-examples to populate products for this shop grid.",
          source: "all",
          category: "",
          limit: 12,
          showSidebar: true,
          showSearch: true,
          showTagCloud: true,
          showSorting: true,
          showSaleBadge: true,
          showPrices: true,
          theme: "auto",
          backgroundColor: "#252626",
          textColor: "#f7f7f7",
          accentColor: "#ddc59f",
        },
        {
          id: id(),
          type: "shop",
          style: "tora-coming-soon",
          title: "LIMITED EDITIONS",
          body: "A coming-soon shop treatment for seasonal print drops or private ordering windows.",
          source: "featured",
          category: "",
          limit: 6,
          showSidebar: false,
          showSearch: false,
          showTagCloud: false,
          showSorting: false,
          showSaleBadge: false,
          showPrices: false,
          theme: "dark",
          backgroundColor: "#111111",
          textColor: "#f8f3df",
          accentColor: "#d8c98d",
        },
        ...(["solid", "pill", "outline", "soft", "link"] as const).map(
          (buttonStyle, index) => ({
            id: id(),
            type: "cta",
            headline: `${buttonStyle} call to action`,
            body: "Use CTA blocks to move visitors from stories into booking, proofing, or shopping.",
            buttonLabel: "Start here",
            buttonHref:
              index % 2 === 0 ? "/demo-contact-styles" : "/demo-pricing-styles",
            buttonStyle,
          }),
        ),
        { id: id(), type: "instagram", title: "From the field", count: 12 },
        customLinkBlock(id(), "link-row", [
          { title: "Pricing", subtitle: "Packages", href: "/demo-pricing-styles" },
          { title: "Contact", subtitle: "Inquiry", href: "/demo-contact-styles" },
          {
            title: "Galleries",
            subtitle: "Public work",
            href: "/galleries/demo-gallery-justified",
          },
        ]),
      ],
    });
  }

  {
    const id = idFactory("demo-maps");
    pages.push({
      id: `${BASE}-page-maps`,
      slug: "demo-maps-taxonomy",
      title: "Locations and Travel Stories",
      type: "standard",
      theme: "auto",
      seoDescription:
        "Category index, location index, location maps, route planning, custom pins, and taxonomy-driven galleries.",
      blocks: [
        ...pageIntro(
          id,
          "LOCATIONS",
          "Locations and travel stories",
          "A taxonomy page demonstrating category indexes, location indexes, map modes, routes, pins, and location-sourced galleries.",
          pick(60),
        ),
        { id: id(), type: "categoryIndex", title: "Browse by category" },
        { id: id(), type: "locationIndex", title: "Browse by location" },
        ...(["interactive", "dotted-network", "route-planning"] as const).map(
          (displayMode, index) => ({
            id: id(),
            type: "locationMap",
            title: `${displayMode.replace(/-/g, " ")} map`,
            subtitle: "Tap a marker to preview the work photographed in each place.",
            locationIds: demoLocations.map((item) => item.id),
            customPins: [
              {
                id: `pin-${index}-1`,
                title: "Studio pickup",
                subtitle: "Chicago proofing appointment",
                lat: "41.881",
                lng: "-87.63",
                photoId: pick(64 + index),
                linkLabel: "View contact",
                linkHref: "/demo-contact-styles",
              },
              {
                id: `pin-${index}-2`,
                title: "Print delivery",
                subtitle: "Regional fulfillment note",
                lat: "39.739",
                lng: "-104.99",
                photoId: pick(68 + index),
                linkLabel: "View shop",
                linkHref: "/demo-commerce-conversion",
              },
            ],
            displayMode,
            height: (["md", "lg", "screen"] as const)[index],
            mapTheme: (["auto", "liberty", "bright"] as const)[index],
            markerColor: "#b98546",
            showLabels: true,
            showControls: index !== 1,
            popupMode: index === 1 ? "hover" : "click",
            networkConnectionMode: index === 1 ? "manual" : "ordered",
            networkConnections: [
              {
                id: `edge-${index}-1`,
                startId: demoLocations[0].id,
                endId: demoLocations[1].id,
              },
              {
                id: `edge-${index}-2`,
                startId: demoLocations[1].id,
                endId: demoLocations[2].id,
              },
            ],
            networkLineColor: "#0ea5e9",
            networkDotColor: "#b98546",
            networkMapDotColor: "#94a3b8",
            networkAnimationSeconds: 2.8 + index,
            networkShowLabels: true,
            routeStyle: index === 2 ? "planning" : "basic",
            routeProvider: index === 2 ? "straight" : "osrm",
            routeTravelMode: (["driving", "walking", "cycling"] as const)[index],
            routePointIds: demoLocations.map((item) => item.id),
            routeStartId: demoLocations[0].id,
            routeEndId: demoLocations[demoLocations.length - 1].id,
            routeShowAlternatives: index === 2,
            routeShowCards: true,
            routeShowStopList: true,
            routeShowMapLinks: index !== 0,
            routeSummaryPosition: (["top-left", "top-right", "bottom-left"] as const)[
              index
            ],
            routeSummaryStyle: (["solid", "glass", "minimal"] as const)[index],
            routeShowLabels: true,
            routeLineColor: "#6366f1",
            routeInactiveLineColor: "#94a3b8",
            routeStartColor: "#22c55e",
            routeEndColor: "#ef4444",
          }),
        ),
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "category",
          targetId: demoCategories[0].id,
          gridType: "justified",
          limit: 12,
        },
        {
          id: id(),
          type: "gallery",
          ...GALLERY_DEFAULTS,
          source: "location",
          targetId: demoLocations[0].id,
          gridType: "masonry",
          limit: 12,
        },
      ],
    });
  }

  const pageConfigIds = pageConfigs.map((item) => item.id);

  await db.delete(menuItem).where(eq(menuItem.label, MENU_LABEL));
  await db.delete(page).where(inArray(page.slug, [...pageSlugs]));
  await db.delete(gallery).where(
    inArray(
      gallery.slug,
      demoGalleries.map((item) => item.slug),
    ),
  );
  await db.delete(collection).where(
    inArray(
      collection.slug,
      demoCategories.map((item) => item.slug),
    ),
  );
  await db.delete(location).where(
    inArray(
      location.slug,
      demoLocations.map((item) => item.slug),
    ),
  );
  await db.delete(pageConfig).where(inArray(pageConfig.id, pageConfigIds));
  await db.delete(client).where(eq(client.id, DEMO_CLIENT_ID));

  await db.insert(pageConfig).values(
    pageConfigs.map((item) => ({
      id: item.id,
      scope: item.scope,
      gridType: item.gridType ?? undefined,
      spacing: item.spacing,
      theme: item.theme,
      hero: item.hero,
      config: item.config,
      isDefault: false,
    })),
  );

  await db.insert(client).values({
    id: DEMO_CLIENT_ID,
    name: "Feature Demo Client",
    email: "feature-demo-client@example.invalid",
    phone: "+1 312 555 0100",
    notes: "Seeded client used only by the feature demo proofing gallery.",
    createdBy: ownerId,
  });

  await db.insert(collection).values(
    demoCategories.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      kind: "category",
      coverPhotoId: pick(item.photoStart),
      sortOrder: item.sortOrder,
      isPublished: true,
      pageConfigId: `${BASE}-config-category-tora-justified`,
    })),
  );
  await db.insert(collectionPhoto).values(
    demoCategories.flatMap((item) =>
      group(item.photoStart, item.photoCount).map((photoId, index) => ({
        collectionId: item.id,
        photoId,
        sortOrder: index,
      })),
    ),
  );

  await db.insert(location).values(
    demoLocations.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      region: item.region,
      lat: item.lat,
      lng: item.lng,
      coverPhotoId: pick(item.photoStart),
      sortOrder: item.sortOrder,
      isPublished: true,
    })),
  );
  await db.insert(photoLocation).values(
    demoLocations.flatMap((item) =>
      group(item.photoStart, item.photoCount).map((photoId, index) => ({
        locationId: item.id,
        photoId,
        sortOrder: index,
      })),
    ),
  );

  await db.insert(gallery).values(
    demoGalleries.map((item, index) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
      visibility: item.visibility ?? "public",
      status: "published" as const,
      ownerId,
      coverPhotoId: pick(item.photoStart),
      pageConfigId: galleryPageConfigIds[index],
      clientId: item.clientId ?? null,
      downloadEnabled: item.downloadEnabled ?? false,
      videoStatus: "none" as const,
      publishedAt: new Date(Date.now() - index * 60_000),
    })),
  );
  await db.insert(galleryPhoto).values(
    demoGalleries.flatMap((item) =>
      group(item.photoStart, item.photoCount).map((photoId, index) => ({
        galleryId: item.id,
        photoId,
        sortOrder: index,
      })),
    ),
  );

  const { raw, hash } = generateShareToken();
  await db.insert(galleryAccessGrant).values({
    id: `${BASE}-proofing-grant`,
    galleryId: `${BASE}-gallery-proofing`,
    clientId: DEMO_CLIENT_ID,
    tokenHash: hash,
    label: "Feature demo proofing share",
    canView: true,
    canFavorite: true,
    canDownload: true,
    createdBy: ownerId,
  });

  for (let index = 0; index < pages.length; index += 1) {
    const item = pages[index];
    const blocks = validateBlocks(item.slug, item.blocks);
    await db.insert(page).values({
      id: item.id,
      slug: item.slug,
      title: item.title,
      type: item.type,
      status: "published",
      isHome: false,
      blocks,
      theme: item.theme ?? "auto",
      seoTitle: item.title,
      seoDescription: item.seoDescription,
      sortOrder: 300 + index,
      publishedAt: new Date(),
    });
  }

  await ensureMenusSeeded();
  const primary = (
    await db.select({ id: menu.id }).from(menu).where(eq(menu.role, "primary")).limit(1)
  )[0];
  if (primary) {
    const parentId = `${BASE}-menu-parent`;
    await db.insert(menuItem).values({
      id: parentId,
      menuId: primary.id,
      label: MENU_LABEL,
      linkType: "page",
      targetId: `${BASE}-page-hub`,
      sortOrder: 900,
      isVisible: true,
    });
    const menuEntries = [
      {
        label: "Demo Hub",
        linkType: "page" as const,
        targetId: `${BASE}-page-hub`,
        url: null,
      },
      {
        label: "Hero Systems",
        linkType: "page" as const,
        targetId: `${BASE}-page-hero`,
        url: null,
      },
      {
        label: "Gallery Blocks",
        linkType: "page" as const,
        targetId: `${BASE}-page-gallery-blocks`,
        url: null,
      },
      {
        label: "Gallery Layouts",
        linkType: "gallery" as const,
        targetId: `${BASE}-gallery-masonry`,
        url: null,
      },
      {
        label: "Categories",
        linkType: "category" as const,
        targetId: `${BASE}-category-editorial-portraits`,
        url: null,
      },
      {
        label: "Locations",
        linkType: "location" as const,
        targetId: `${BASE}-location-chicago-studio`,
        url: null,
      },
      {
        label: "Pricing",
        linkType: "page" as const,
        targetId: `${BASE}-page-pricing`,
        url: null,
      },
      {
        label: "Contact",
        linkType: "page" as const,
        targetId: `${BASE}-page-contact`,
        url: null,
      },
    ];
    await db.insert(menuItem).values(
      menuEntries.map((entry, index) => ({
        id: `${BASE}-menu-${index}`,
        menuId: primary.id,
        parentId,
        label: entry.label,
        linkType: entry.linkType,
        targetId: entry.targetId,
        url: entry.url,
        sortOrder: index,
        isVisible: true,
      })),
    );
    await invalidateMenu("primary");
  }

  const baseUrl = getEnv().APP_BASE_URL.replace(/\/+$/, "");
  const proofingUrl = `${baseUrl}/g/${raw}`;
  console.log(`[seed-feature-demos] pages: ${pages.length}`);
  console.log(`[seed-feature-demos] galleries: ${demoGalleries.length}`);
  console.log(`[seed-feature-demos] categories: ${demoCategories.length}`);
  console.log(`[seed-feature-demos] locations: ${demoLocations.length}`);
  console.log(`[seed-feature-demos] page configs: ${pageConfigs.length}`);
  console.log("[seed-feature-demos] view:");
  console.log(`  ${baseUrl}/demo-features`);
  console.log(`  ${baseUrl}/galleries/demo-gallery-masonry`);
  console.log(`  ${baseUrl}/categories/demo-editorial-portraits`);
  console.log(`  ${baseUrl}/locations/demo-chicago-studio`);
  console.log(`[seed-feature-demos] private proofing share link: ${proofingUrl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
