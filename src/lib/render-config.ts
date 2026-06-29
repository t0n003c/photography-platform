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
  };
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
  };
}
