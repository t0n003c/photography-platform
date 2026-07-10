import { getSession } from "@/src/auth/session";
import { resolvePageConfig } from "@/src/db/queries/public";
import { decodePreview, PREVIEW_PARAM } from "@/src/lib/preview";

export type GridType =
  | "masonry"
  | "justified"
  | "uniform"
  | "horizontal-lenis"
  | "parallax-ring"
  | "image-trail"
  | "rotating-scroll"
  | "diagonal-slideshow"
  | "depth-gallery"
  | "infinite-canvas"
  | "css-glitch"
  | "palmer-draggable"
  | "tora-sliphover"
  | "tora-justified-showcase"
  | "carousel-3d-scroll"
  | "alternative-scroll";
export type Scope =
  | "home"
  | "gallery"
  | "category"
  | "location"
  | "about"
  | "global";

export type HlOverlay = "minimal" | "editorial" | "centered";

export interface AlternativeScrollConfig {
  useBackground: boolean;
  backgroundColor: string;
  textColor: string;
  showText: boolean;
}

export type ImageTrailVariant =
  | "fade-shrink"
  | "zoom-fade"
  | "drop"
  | "scatter"
  | "stretch-drop"
  | "full-frame";

export interface ImageTrailConfig {
  variant: ImageTrailVariant;
  useBackground: boolean;
  backgroundColor: string;
}

export type RotatingScrollVariant =
  | "demo1"
  | "demo2"
  | "demo3"
  | "demo4"
  | "demo5";

export interface RotatingScrollConfig {
  variant: RotatingScrollVariant;
  useBackground: boolean;
  backgroundColor: string;
  marqueeText: string;
}

export interface DiagonalSlideshowConfig {
  useBackground: boolean;
  backgroundColor: string;
  textColor: string;
  decoColor: string;
  sideText: string;
  showSideText: boolean;
  showDetail: boolean;
}

export type DepthGalleryLabelStyle = "color-chip" | "metadata" | "minimal";
export type DepthGalleryScrollSpeed = "slow" | "normal" | "fast";

export interface DepthGalleryConfig {
  useMoodBackground: boolean;
  showTrail: boolean;
  showParticles: boolean;
  labelStyle: DepthGalleryLabelStyle;
  scrollSpeed: DepthGalleryScrollSpeed;
  backgroundColor: string;
}

export type InfiniteCanvasDensity = "sparse" | "normal" | "dense";
export type InfiniteCanvasImageSize = "small" | "medium" | "large";
export type InfiniteCanvasMovement = "slow" | "normal" | "fast";

export interface InfiniteCanvasConfig {
  backgroundColor: string;
  fogColor: string;
  density: InfiniteCanvasDensity;
  imageSize: InfiniteCanvasImageSize;
  movement: InfiniteCanvasMovement;
  showControls: boolean;
  enableKeyboard: boolean;
}

export type PalmerDensity = "compact" | "normal" | "wide";
export type PalmerItemSize = "small" | "medium" | "large";

export interface PalmerDraggableConfig {
  density: PalmerDensity;
  itemSize: PalmerItemSize;
  showDetails: boolean;
  useCustomColors: boolean;
  backgroundColor: string;
  textColor: string;
}

export type ToraSliphoverLabelSource = "auto" | "headline" | "alt" | "caption";
export type ToraJustifiedTitleSource = ToraSliphoverLabelSource;

export interface ToraSliphoverConfig {
  useBackground: boolean;
  backgroundColor: string;
  labelSource: ToraSliphoverLabelSource;
  labelBackgroundColor: string;
  labelTextColor: string;
}

export interface ToraJustifiedConfig {
  useBackground: boolean;
  backgroundColor: string;
  titleColor: string;
  accentColor: string;
  titleSource: ToraJustifiedTitleSource;
  rowHeightFactor: number;
  desktopGutter: number;
  mobileGutter: number;
  hoverInset: boolean;
  dimOnLeadHover: boolean;
  scrollOnSelect: boolean;
}

export interface RenderConfig {
  gridType: GridType;
  spacing: string;
  theme: "light" | "dark" | "auto";
  hero: { enabled?: boolean; headline?: string } | null;
  // Text-overlay style for the horizontal-scroll detail view.
  overlay: HlOverlay;
  alternativeScroll: AlternativeScrollConfig;
  imageTrail: ImageTrailConfig;
  rotatingScroll: RotatingScrollConfig;
  diagonalSlideshow: DiagonalSlideshowConfig;
  depthGallery: DepthGalleryConfig;
  infiniteCanvas: InfiniteCanvasConfig;
  palmerDraggable: PalmerDraggableConfig;
  toraSliphover: ToraSliphoverConfig;
  toraJustified: ToraJustifiedConfig;
}

function imageTrailVariant(value: unknown): ImageTrailVariant {
  if (
    value === "fade-shrink" ||
    value === "zoom-fade" ||
    value === "drop" ||
    value === "scatter" ||
    value === "stretch-drop" ||
    value === "full-frame"
  ) {
    return value;
  }
  return "fade-shrink";
}

function rotatingScrollVariant(value: unknown): RotatingScrollVariant {
  if (
    value === "demo1" ||
    value === "demo2" ||
    value === "demo3" ||
    value === "demo4" ||
    value === "demo5"
  ) {
    return value;
  }
  return "demo5";
}

function depthLabelStyle(value: unknown): DepthGalleryLabelStyle {
  if (value === "metadata" || value === "minimal" || value === "color-chip") {
    return value;
  }
  return "color-chip";
}

function depthScrollSpeed(value: unknown): DepthGalleryScrollSpeed {
  if (value === "slow" || value === "fast" || value === "normal") {
    return value;
  }
  return "normal";
}

function infiniteDensity(value: unknown): InfiniteCanvasDensity {
  if (value === "sparse" || value === "dense" || value === "normal") {
    return value;
  }
  return "normal";
}

function infiniteImageSize(value: unknown): InfiniteCanvasImageSize {
  if (value === "small" || value === "large" || value === "medium") {
    return value;
  }
  return "medium";
}

function infiniteMovement(value: unknown): InfiniteCanvasMovement {
  if (value === "slow" || value === "fast" || value === "normal") {
    return value;
  }
  return "normal";
}

function palmerDensity(value: unknown): PalmerDensity {
  if (value === "compact" || value === "wide" || value === "normal") return value;
  return "normal";
}

function palmerItemSize(value: unknown): PalmerItemSize {
  if (value === "small" || value === "large" || value === "medium") return value;
  return "medium";
}

function toraSliphoverLabelSource(value: unknown): ToraSliphoverLabelSource {
  if (value === "headline" || value === "alt" || value === "caption" || value === "auto") {
    return value;
  }
  return "auto";
}

function toraJustifiedTitleSource(value: unknown): ToraJustifiedTitleSource {
  return toraSliphoverLabelSource(value);
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const DEFAULT_PALMER_BACKGROUND = "#f1f1f1";
const DEFAULT_PALMER_TEXT = "#313131";
const DEFAULT_SLIPHOVER_BACKGROUND = "#f3eadb";
const LEGACY_SLIPHOVER_DARK_BACKGROUND = "#242625";

function isDefaultPalmerColor(value: unknown, defaultValue: string) {
  return (
    typeof value !== "string" ||
    value.trim().toLowerCase() === defaultValue.toLowerCase()
  );
}

function sliphoverBackgroundColor(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_SLIPHOVER_BACKGROUND;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === DEFAULT_SLIPHOVER_BACKGROUND ||
    normalized === LEGACY_SLIPHOVER_DARK_BACKGROUND
  ) {
    return DEFAULT_SLIPHOVER_BACKGROUND;
  }
  return value;
}

type SearchParams = Record<string, string | string[] | undefined> | undefined;

// Resolves the page-config a public page should render with, applying an
// admin-only DRAFT override when the Design editor passes `__pc` (live preview).
export async function resolveRenderConfig(
  scope: Scope,
  explicitId: string | null | undefined,
  searchParams: SearchParams,
  defaultGrid: GridType,
  options: { allowDraftPreview?: boolean } = {},
): Promise<RenderConfig> {
  const base = await resolvePageConfig(scope, explicitId ?? undefined);
  const cfgJson = (base?.config ?? {}) as {
    hlOverlay?: HlOverlay;
    altUseBackground?: boolean;
    altBackgroundColor?: string;
    altTextColor?: string;
    altShowText?: boolean;
    imgTrailVariant?: ImageTrailVariant;
    imgTrailUseBackground?: boolean;
    imgTrailBackgroundColor?: string;
    rotatingScrollVariant?: RotatingScrollVariant;
    rotatingScrollUseBackground?: boolean;
    rotatingScrollBackgroundColor?: string;
    rotatingScrollMarqueeText?: string;
    diagonalUseBackground?: boolean;
    diagonalBackgroundColor?: string;
    diagonalTextColor?: string;
    diagonalDecoColor?: string;
    diagonalSideText?: string;
    diagonalShowSideText?: boolean;
    diagonalShowDetail?: boolean;
    depthUseMoodBackground?: boolean;
    depthShowTrail?: boolean;
    depthShowParticles?: boolean;
    depthLabelStyle?: DepthGalleryLabelStyle;
    depthScrollSpeed?: DepthGalleryScrollSpeed;
    depthBackgroundColor?: string;
    infiniteBackgroundColor?: string;
    infiniteFogColor?: string;
    infiniteDensity?: InfiniteCanvasDensity;
    infiniteImageSize?: InfiniteCanvasImageSize;
    infiniteMovement?: InfiniteCanvasMovement;
    infiniteShowControls?: boolean;
    infiniteEnableKeyboard?: boolean;
    palmerDensity?: PalmerDensity;
    palmerItemSize?: PalmerItemSize;
    palmerShowDetails?: boolean;
    palmerUseCustomColors?: boolean;
    palmerBackgroundColor?: string;
    palmerTextColor?: string;
    toraSliphoverUseBackground?: boolean;
    toraSliphoverBackgroundColor?: string;
    toraSliphoverLabelSource?: ToraSliphoverLabelSource;
    toraSliphoverLabelBackgroundColor?: string;
    toraSliphoverLabelTextColor?: string;
    toraJustifiedUseBackground?: boolean;
    toraJustifiedBackgroundColor?: string;
    toraJustifiedTitleColor?: string;
    toraJustifiedAccentColor?: string;
    toraJustifiedTitleSource?: ToraJustifiedTitleSource;
    toraJustifiedRowHeightFactor?: number;
    toraJustifiedDesktopGutter?: number;
    toraJustifiedMobileGutter?: number;
    toraJustifiedHoverInset?: boolean;
    toraJustifiedDimOnLeadHover?: boolean;
    toraJustifiedScrollOnSelect?: boolean;
  };
  const palmerUsesCustomColors =
    cfgJson.palmerUseCustomColors ??
    !(
      isDefaultPalmerColor(cfgJson.palmerBackgroundColor, DEFAULT_PALMER_BACKGROUND) &&
      isDefaultPalmerColor(cfgJson.palmerTextColor, DEFAULT_PALMER_TEXT)
    );
  const config: RenderConfig = {
    gridType: (base?.gridType as GridType | null) ?? defaultGrid,
    spacing: base?.spacing ?? "normal",
    theme: (base?.theme as RenderConfig["theme"] | null) ?? "auto",
    hero: (base?.hero as RenderConfig["hero"]) ?? null,
    overlay: cfgJson.hlOverlay ?? "minimal",
    alternativeScroll: {
      useBackground: cfgJson.altUseBackground ?? true,
      backgroundColor: cfgJson.altBackgroundColor ?? "#b7b19f",
      textColor: cfgJson.altTextColor ?? "#111111",
      showText: cfgJson.altShowText ?? true,
    },
    imageTrail: {
      variant: imageTrailVariant(cfgJson.imgTrailVariant),
      useBackground: cfgJson.imgTrailUseBackground ?? true,
      backgroundColor: cfgJson.imgTrailBackgroundColor ?? "#efece5",
    },
    rotatingScroll: {
      variant: rotatingScrollVariant(cfgJson.rotatingScrollVariant),
      useBackground: cfgJson.rotatingScrollUseBackground ?? true,
      backgroundColor: cfgJson.rotatingScrollBackgroundColor ?? "#141414",
      marqueeText:
        typeof cfgJson.rotatingScrollMarqueeText === "string"
          ? cfgJson.rotatingScrollMarqueeText
          : "",
    },
    diagonalSlideshow: {
      useBackground: cfgJson.diagonalUseBackground ?? true,
      backgroundColor: cfgJson.diagonalBackgroundColor ?? "#0c0c0c",
      textColor: cfgJson.diagonalTextColor ?? "#f1f1f1",
      decoColor: cfgJson.diagonalDecoColor ?? "#141414",
      sideText:
        typeof cfgJson.diagonalSideText === "string"
          ? cfgJson.diagonalSideText
          : "",
      showSideText: cfgJson.diagonalShowSideText ?? true,
      showDetail: cfgJson.diagonalShowDetail ?? true,
    },
    depthGallery: {
      useMoodBackground: cfgJson.depthUseMoodBackground ?? true,
      showTrail: cfgJson.depthShowTrail ?? true,
      showParticles: cfgJson.depthShowParticles ?? true,
      labelStyle: depthLabelStyle(cfgJson.depthLabelStyle),
      scrollSpeed: depthScrollSpeed(cfgJson.depthScrollSpeed),
      backgroundColor: cfgJson.depthBackgroundColor ?? "#fffaf0",
    },
    infiniteCanvas: {
      backgroundColor: cfgJson.infiniteBackgroundColor ?? "#f4f1ea",
      fogColor: cfgJson.infiniteFogColor ?? "#f4f1ea",
      density: infiniteDensity(cfgJson.infiniteDensity),
      imageSize: infiniteImageSize(cfgJson.infiniteImageSize),
      movement: infiniteMovement(cfgJson.infiniteMovement),
      showControls: cfgJson.infiniteShowControls ?? true,
      enableKeyboard: cfgJson.infiniteEnableKeyboard ?? true,
    },
    palmerDraggable: {
      density: palmerDensity(cfgJson.palmerDensity),
      itemSize: palmerItemSize(cfgJson.palmerItemSize),
      showDetails: cfgJson.palmerShowDetails ?? true,
      useCustomColors: palmerUsesCustomColors,
      backgroundColor: cfgJson.palmerBackgroundColor ?? DEFAULT_PALMER_BACKGROUND,
      textColor: cfgJson.palmerTextColor ?? DEFAULT_PALMER_TEXT,
    },
    toraSliphover: {
      useBackground: cfgJson.toraSliphoverUseBackground ?? true,
      backgroundColor: sliphoverBackgroundColor(
        cfgJson.toraSliphoverBackgroundColor,
      ),
      labelSource: toraSliphoverLabelSource(cfgJson.toraSliphoverLabelSource),
      labelBackgroundColor: cfgJson.toraSliphoverLabelBackgroundColor ?? "#111111",
      labelTextColor: cfgJson.toraSliphoverLabelTextColor ?? "#f8f3df",
    },
    toraJustified: {
      useBackground: cfgJson.toraJustifiedUseBackground ?? true,
      backgroundColor: cfgJson.toraJustifiedBackgroundColor ?? "#252626",
      titleColor: cfgJson.toraJustifiedTitleColor ?? "#f7f7f7",
      accentColor: cfgJson.toraJustifiedAccentColor ?? "#edd8aa",
      titleSource: toraJustifiedTitleSource(cfgJson.toraJustifiedTitleSource),
      rowHeightFactor: boundedNumber(
        cfgJson.toraJustifiedRowHeightFactor,
        7,
        5,
        10,
      ),
      desktopGutter: boundedNumber(cfgJson.toraJustifiedDesktopGutter, 25, 0, 60),
      mobileGutter: boundedNumber(cfgJson.toraJustifiedMobileGutter, 15, 0, 40),
      hoverInset: cfgJson.toraJustifiedHoverInset ?? true,
      dimOnLeadHover: cfgJson.toraJustifiedDimOnLeadHover ?? true,
      scrollOnSelect: cfgJson.toraJustifiedScrollOnSelect ?? true,
    },
  };

  const rawParam = searchParams?.[PREVIEW_PARAM];
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw) return config;

  // Drafts apply only for authenticated admins (the design previewer), except
  // for explicit preview routes that have already verified a published public
  // surface and opt into reading the draft URL payload.
  if (!options.allowDraftPreview) {
    const session = await getSession();
    if (!session) return config;
  }

  const draft = decodePreview(raw);
  if (!draft) return config;
  return {
    gridType: draft.gridType ?? config.gridType,
    spacing: draft.spacing ?? config.spacing,
    theme: draft.theme ?? config.theme,
    hero: draft.hero !== undefined ? draft.hero : config.hero,
    overlay: draft.overlay ?? config.overlay,
    alternativeScroll: {
      useBackground:
        draft.altUseBackground ?? config.alternativeScroll.useBackground,
      backgroundColor:
        draft.altBackgroundColor ?? config.alternativeScroll.backgroundColor,
      textColor: draft.altTextColor ?? config.alternativeScroll.textColor,
      showText: draft.altShowText ?? config.alternativeScroll.showText,
    },
    imageTrail: {
      variant:
        draft.imgTrailVariant !== undefined
          ? imageTrailVariant(draft.imgTrailVariant)
          : config.imageTrail.variant,
      useBackground:
        draft.imgTrailUseBackground ?? config.imageTrail.useBackground,
      backgroundColor:
        draft.imgTrailBackgroundColor ?? config.imageTrail.backgroundColor,
    },
    rotatingScroll: {
      variant:
        draft.rotatingScrollVariant !== undefined
          ? rotatingScrollVariant(draft.rotatingScrollVariant)
          : config.rotatingScroll.variant,
      useBackground:
        draft.rotatingScrollUseBackground ??
        config.rotatingScroll.useBackground,
      backgroundColor:
        draft.rotatingScrollBackgroundColor ??
        config.rotatingScroll.backgroundColor,
      marqueeText:
        draft.rotatingScrollMarqueeText ??
        config.rotatingScroll.marqueeText,
    },
    diagonalSlideshow: {
      useBackground:
        draft.diagonalUseBackground ??
        config.diagonalSlideshow.useBackground,
      backgroundColor:
        draft.diagonalBackgroundColor ??
        config.diagonalSlideshow.backgroundColor,
      textColor:
        draft.diagonalTextColor ?? config.diagonalSlideshow.textColor,
      decoColor:
        draft.diagonalDecoColor ?? config.diagonalSlideshow.decoColor,
      sideText:
        draft.diagonalSideText ?? config.diagonalSlideshow.sideText,
      showSideText:
        draft.diagonalShowSideText ??
        config.diagonalSlideshow.showSideText,
      showDetail:
        draft.diagonalShowDetail ?? config.diagonalSlideshow.showDetail,
    },
    depthGallery: {
      useMoodBackground:
        draft.depthUseMoodBackground ??
        config.depthGallery.useMoodBackground,
      showTrail: draft.depthShowTrail ?? config.depthGallery.showTrail,
      showParticles:
        draft.depthShowParticles ?? config.depthGallery.showParticles,
      labelStyle:
        draft.depthLabelStyle !== undefined
          ? depthLabelStyle(draft.depthLabelStyle)
          : config.depthGallery.labelStyle,
      scrollSpeed:
        draft.depthScrollSpeed !== undefined
          ? depthScrollSpeed(draft.depthScrollSpeed)
          : config.depthGallery.scrollSpeed,
      backgroundColor:
        draft.depthBackgroundColor ?? config.depthGallery.backgroundColor,
    },
    infiniteCanvas: {
      backgroundColor:
        draft.infiniteBackgroundColor ??
        config.infiniteCanvas.backgroundColor,
      fogColor: draft.infiniteFogColor ?? config.infiniteCanvas.fogColor,
      density:
        draft.infiniteDensity !== undefined
          ? infiniteDensity(draft.infiniteDensity)
          : config.infiniteCanvas.density,
      imageSize:
        draft.infiniteImageSize !== undefined
          ? infiniteImageSize(draft.infiniteImageSize)
          : config.infiniteCanvas.imageSize,
      movement:
        draft.infiniteMovement !== undefined
          ? infiniteMovement(draft.infiniteMovement)
          : config.infiniteCanvas.movement,
      showControls:
        draft.infiniteShowControls ?? config.infiniteCanvas.showControls,
      enableKeyboard:
        draft.infiniteEnableKeyboard ?? config.infiniteCanvas.enableKeyboard,
    },
    palmerDraggable: {
      density:
        draft.palmerDensity !== undefined
          ? palmerDensity(draft.palmerDensity)
          : config.palmerDraggable.density,
      itemSize:
        draft.palmerItemSize !== undefined
          ? palmerItemSize(draft.palmerItemSize)
          : config.palmerDraggable.itemSize,
      showDetails:
        draft.palmerShowDetails ?? config.palmerDraggable.showDetails,
      useCustomColors:
        draft.palmerUseCustomColors ??
        config.palmerDraggable.useCustomColors,
      backgroundColor:
        draft.palmerBackgroundColor ?? config.palmerDraggable.backgroundColor,
      textColor: draft.palmerTextColor ?? config.palmerDraggable.textColor,
    },
    toraSliphover: {
      useBackground:
        draft.toraSliphoverUseBackground ??
        config.toraSliphover.useBackground,
      backgroundColor:
        draft.toraSliphoverBackgroundColor !== undefined
          ? sliphoverBackgroundColor(draft.toraSliphoverBackgroundColor)
          : config.toraSliphover.backgroundColor,
      labelSource:
        draft.toraSliphoverLabelSource !== undefined
          ? toraSliphoverLabelSource(draft.toraSliphoverLabelSource)
          : config.toraSliphover.labelSource,
      labelBackgroundColor:
        draft.toraSliphoverLabelBackgroundColor ??
        config.toraSliphover.labelBackgroundColor,
      labelTextColor:
        draft.toraSliphoverLabelTextColor ??
        config.toraSliphover.labelTextColor,
    },
    toraJustified: {
      useBackground:
        draft.toraJustifiedUseBackground ??
        config.toraJustified.useBackground,
      backgroundColor:
        draft.toraJustifiedBackgroundColor ??
        config.toraJustified.backgroundColor,
      titleColor:
        draft.toraJustifiedTitleColor ?? config.toraJustified.titleColor,
      accentColor:
        draft.toraJustifiedAccentColor ?? config.toraJustified.accentColor,
      titleSource:
        draft.toraJustifiedTitleSource !== undefined
          ? toraJustifiedTitleSource(draft.toraJustifiedTitleSource)
          : config.toraJustified.titleSource,
      rowHeightFactor: boundedNumber(
        draft.toraJustifiedRowHeightFactor,
        config.toraJustified.rowHeightFactor,
        5,
        10,
      ),
      desktopGutter: boundedNumber(
        draft.toraJustifiedDesktopGutter,
        config.toraJustified.desktopGutter,
        0,
        60,
      ),
      mobileGutter: boundedNumber(
        draft.toraJustifiedMobileGutter,
        config.toraJustified.mobileGutter,
        0,
        40,
      ),
      hoverInset:
        draft.toraJustifiedHoverInset ?? config.toraJustified.hoverInset,
      dimOnLeadHover:
        draft.toraJustifiedDimOnLeadHover ??
        config.toraJustified.dimOnLeadHover,
      scrollOnSelect:
        draft.toraJustifiedScrollOnSelect ??
        config.toraJustified.scrollOnSelect,
    },
  };
}
