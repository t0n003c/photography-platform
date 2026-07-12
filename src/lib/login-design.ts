export type LoginLayout = "simple" | "gradient-card" | "split-photo";
export type LoginBackgroundMode = "default" | "soft-gradient" | "custom" | "photo";
export type LoginPhotoSide = "left" | "right";
export type LoginCardMaterial =
  | "layout-default"
  | "solid"
  | "soft-glass"
  | "liquid-glass";

export interface LoginDesignConfig {
  layout: LoginLayout;
  headline: string;
  subtitle: string;
  showBrand: boolean;
  showIconRow: boolean;
  backgroundMode: LoginBackgroundMode;
  backgroundColor: string;
  gradientFrom: string;
  gradientTo: string;
  backgroundPhotoId: string | null;
  backgroundPhotoUrl: string;
  backgroundPhotoFocalX: number;
  backgroundPhotoFocalY: number;
  backgroundPhotoDim: number;
  backgroundPhotoBlur: number;
  cardAccent: string;
  hoverColor: string;
  hoverGlowSize: number;
  hoverGlowIntensity: number;
  cardMaterial: LoginCardMaterial;
  liquidGlassStrength: number;
  liquidGlassChroma: number;
  liquidGlassBlur: number;
  liquidGlassSaturate: number;
  liquidGlassFallbackBlur: number;
  primaryLabel: string;
  passkeyLabel: string;
  photoId: string | null;
  photoUrl: string;
  photoAlt: string;
  photoSide: LoginPhotoSide;
  photoFocalX: number;
  photoFocalY: number;
  photoWidth: number;
  showPhotoOnMobile: boolean;
}

export const DEFAULT_LOGIN_DESIGN: LoginDesignConfig = {
  layout: "simple",
  headline: "Welcome back",
  subtitle: "Sign in to the studio admin",
  showBrand: true,
  showIconRow: false,
  backgroundMode: "default",
  backgroundColor: "#f8fafc",
  gradientFrom: "#7c3aed",
  gradientTo: "#06b6d4",
  backgroundPhotoId: null,
  backgroundPhotoUrl: "",
  backgroundPhotoFocalX: 50,
  backgroundPhotoFocalY: 50,
  backgroundPhotoDim: 42,
  backgroundPhotoBlur: 0,
  cardAccent: "#8b5cf6",
  hoverColor: "#f97316",
  hoverGlowSize: 44,
  hoverGlowIntensity: 34,
  cardMaterial: "layout-default",
  liquidGlassStrength: 96,
  liquidGlassChroma: 5,
  liquidGlassBlur: 3,
  liquidGlassSaturate: 1.45,
  liquidGlassFallbackBlur: 16,
  primaryLabel: "Sign in",
  passkeyLabel: "Sign in with passkey",
  photoId: null,
  photoUrl: "",
  photoAlt: "Studio photograph",
  photoSide: "left",
  photoFocalX: 50,
  photoFocalY: 50,
  photoWidth: 50,
  showPhotoOnMobile: true,
};

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function normalizeLoginDesign(value: unknown): LoginDesignConfig {
  const input =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof LoginDesignConfig, unknown>>)
      : {};

  return {
    layout: enumValue(
      input.layout,
      ["simple", "gradient-card", "split-photo"] as const,
      DEFAULT_LOGIN_DESIGN.layout,
    ),
    headline: stringValue(input.headline, DEFAULT_LOGIN_DESIGN.headline),
    subtitle: stringValue(input.subtitle, DEFAULT_LOGIN_DESIGN.subtitle),
    showBrand: booleanValue(input.showBrand, DEFAULT_LOGIN_DESIGN.showBrand),
    showIconRow: booleanValue(input.showIconRow, DEFAULT_LOGIN_DESIGN.showIconRow),
    backgroundMode: enumValue(
      input.backgroundMode,
      ["default", "soft-gradient", "custom", "photo"] as const,
      DEFAULT_LOGIN_DESIGN.backgroundMode,
    ),
    backgroundColor: stringValue(
      input.backgroundColor,
      DEFAULT_LOGIN_DESIGN.backgroundColor,
    ),
    gradientFrom: stringValue(input.gradientFrom, DEFAULT_LOGIN_DESIGN.gradientFrom),
    gradientTo: stringValue(input.gradientTo, DEFAULT_LOGIN_DESIGN.gradientTo),
    backgroundPhotoId:
      typeof input.backgroundPhotoId === "string" ? input.backgroundPhotoId : null,
    backgroundPhotoUrl: stringValue(
      input.backgroundPhotoUrl,
      DEFAULT_LOGIN_DESIGN.backgroundPhotoUrl,
    ),
    backgroundPhotoFocalX: numberValue(
      input.backgroundPhotoFocalX,
      DEFAULT_LOGIN_DESIGN.backgroundPhotoFocalX,
      0,
      100,
    ),
    backgroundPhotoFocalY: numberValue(
      input.backgroundPhotoFocalY,
      DEFAULT_LOGIN_DESIGN.backgroundPhotoFocalY,
      0,
      100,
    ),
    backgroundPhotoDim: numberValue(
      input.backgroundPhotoDim,
      DEFAULT_LOGIN_DESIGN.backgroundPhotoDim,
      0,
      85,
    ),
    backgroundPhotoBlur: numberValue(
      input.backgroundPhotoBlur,
      DEFAULT_LOGIN_DESIGN.backgroundPhotoBlur,
      0,
      24,
    ),
    cardAccent: stringValue(input.cardAccent, DEFAULT_LOGIN_DESIGN.cardAccent),
    hoverColor: stringValue(input.hoverColor, DEFAULT_LOGIN_DESIGN.hoverColor),
    hoverGlowSize: numberValue(
      input.hoverGlowSize,
      DEFAULT_LOGIN_DESIGN.hoverGlowSize,
      24,
      70,
    ),
    hoverGlowIntensity: numberValue(
      input.hoverGlowIntensity,
      DEFAULT_LOGIN_DESIGN.hoverGlowIntensity,
      0,
      70,
    ),
    cardMaterial: enumValue(
      input.cardMaterial,
      ["layout-default", "solid", "soft-glass", "liquid-glass"] as const,
      DEFAULT_LOGIN_DESIGN.cardMaterial,
    ),
    liquidGlassStrength: numberValue(
      input.liquidGlassStrength,
      DEFAULT_LOGIN_DESIGN.liquidGlassStrength,
      40,
      180,
    ),
    liquidGlassChroma: numberValue(
      input.liquidGlassChroma,
      DEFAULT_LOGIN_DESIGN.liquidGlassChroma,
      0,
      14,
    ),
    liquidGlassBlur: numberValue(
      input.liquidGlassBlur,
      DEFAULT_LOGIN_DESIGN.liquidGlassBlur,
      0,
      12,
    ),
    liquidGlassSaturate: numberValue(
      input.liquidGlassSaturate,
      DEFAULT_LOGIN_DESIGN.liquidGlassSaturate,
      1,
      2.2,
    ),
    liquidGlassFallbackBlur: numberValue(
      input.liquidGlassFallbackBlur,
      DEFAULT_LOGIN_DESIGN.liquidGlassFallbackBlur,
      8,
      32,
    ),
    primaryLabel: stringValue(input.primaryLabel, DEFAULT_LOGIN_DESIGN.primaryLabel),
    passkeyLabel: stringValue(input.passkeyLabel, DEFAULT_LOGIN_DESIGN.passkeyLabel),
    photoId: typeof input.photoId === "string" ? input.photoId : null,
    photoUrl: stringValue(input.photoUrl, DEFAULT_LOGIN_DESIGN.photoUrl),
    photoAlt: stringValue(input.photoAlt, DEFAULT_LOGIN_DESIGN.photoAlt),
    photoSide: enumValue(
      input.photoSide,
      ["left", "right"] as const,
      DEFAULT_LOGIN_DESIGN.photoSide,
    ),
    photoFocalX: numberValue(
      input.photoFocalX,
      DEFAULT_LOGIN_DESIGN.photoFocalX,
      0,
      100,
    ),
    photoFocalY: numberValue(
      input.photoFocalY,
      DEFAULT_LOGIN_DESIGN.photoFocalY,
      0,
      100,
    ),
    photoWidth: numberValue(input.photoWidth, DEFAULT_LOGIN_DESIGN.photoWidth, 35, 70),
    showPhotoOnMobile: booleanValue(
      input.showPhotoOnMobile,
      DEFAULT_LOGIN_DESIGN.showPhotoOnMobile,
    ),
  };
}

export function resolveLoginCardMaterial(
  design: Pick<LoginDesignConfig, "layout" | "cardMaterial">,
): Exclude<LoginCardMaterial, "layout-default"> {
  if (design.cardMaterial !== "layout-default") return design.cardMaterial;
  return design.layout === "simple" ? "solid" : "soft-glass";
}
