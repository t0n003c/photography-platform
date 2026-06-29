// Live-design preview: the admin Design editor encodes a DRAFT page-config and
// passes it to the real public page via the `__pc` query param. The page applies
// it ONLY for an authenticated admin (see resolveRenderConfig), so normal
// visitors never see unsaved drafts. Theme is forced via `__theme` (middleware
// → x-preview-theme header → root layout forcedTheme).

export interface PreviewConfig {
  gridType?:
    | "masonry"
    | "justified"
    | "uniform"
    | "horizontal-lenis"
    | "parallax-ring"
    | "image-trail"
    | "rotating-scroll"
    | "diagonal-slideshow"
    | "carousel-3d-scroll"
    | "alternative-scroll";
  spacing?: string;
  theme?: "light" | "dark" | "auto";
  hero?: { enabled?: boolean; headline?: string } | null;
  overlay?: "minimal" | "editorial" | "centered";
  altUseBackground?: boolean;
  altBackgroundColor?: string;
  altTextColor?: string;
  altShowText?: boolean;
  imgTrailVariant?:
    | "fade-shrink"
    | "zoom-fade"
    | "drop"
    | "scatter"
    | "stretch-drop"
    | "full-frame";
  imgTrailUseBackground?: boolean;
  imgTrailBackgroundColor?: string;
  rotatingScrollVariant?: "demo1" | "demo2" | "demo3" | "demo4" | "demo5";
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
}

export const PREVIEW_PARAM = "__pc";
export const PREVIEW_THEME_PARAM = "__theme";

export function encodePreview(cfg: PreviewConfig): string {
  return Buffer.from(JSON.stringify(cfg)).toString("base64url");
}

export function decodePreview(raw: string | undefined): PreviewConfig | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return obj && typeof obj === "object" ? (obj as PreviewConfig) : null;
  } catch {
    return null;
  }
}
