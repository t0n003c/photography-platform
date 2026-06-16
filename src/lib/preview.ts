// Live-design preview: the admin Design editor encodes a DRAFT page-config and
// passes it to the real public page via the `__pc` query param. The page applies
// it ONLY for an authenticated admin (see resolveRenderConfig), so normal
// visitors never see unsaved drafts. Theme is forced via `__theme` (middleware
// → x-preview-theme header → root layout forcedTheme).

export interface PreviewConfig {
  gridType?: "masonry" | "justified" | "uniform";
  spacing?: string;
  theme?: "light" | "dark" | "auto";
  hero?: { enabled?: boolean; headline?: string } | null;
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
