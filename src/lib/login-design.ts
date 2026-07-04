export type LoginLayout = "simple" | "gradient-card" | "split-photo";
export type LoginBackgroundMode = "default" | "soft-gradient" | "custom";
export type LoginPhotoSide = "left" | "right";

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
  cardAccent: string;
  hoverColor: string;
  primaryLabel: string;
  passkeyLabel: string;
  photoId: string | null;
  photoUrl: string;
  photoAlt: string;
  photoSide: LoginPhotoSide;
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
  cardAccent: "#8b5cf6",
  hoverColor: "#f97316",
  primaryLabel: "Sign in",
  passkeyLabel: "Sign in with passkey",
  photoId: null,
  photoUrl: "",
  photoAlt: "Studio photograph",
  photoSide: "left",
};

function stringValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
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
      ["default", "soft-gradient", "custom"] as const,
      DEFAULT_LOGIN_DESIGN.backgroundMode,
    ),
    backgroundColor: stringValue(
      input.backgroundColor,
      DEFAULT_LOGIN_DESIGN.backgroundColor,
    ),
    gradientFrom: stringValue(input.gradientFrom, DEFAULT_LOGIN_DESIGN.gradientFrom),
    gradientTo: stringValue(input.gradientTo, DEFAULT_LOGIN_DESIGN.gradientTo),
    cardAccent: stringValue(input.cardAccent, DEFAULT_LOGIN_DESIGN.cardAccent),
    hoverColor: stringValue(input.hoverColor, DEFAULT_LOGIN_DESIGN.hoverColor),
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
  };
}
