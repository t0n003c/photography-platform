import { getSession } from "@/src/auth/session";
import { resolvePageConfig } from "@/src/db/queries/public";
import { decodePreview, PREVIEW_PARAM } from "@/src/lib/preview";

export type GridType = "masonry" | "justified" | "uniform" | "horizontal-lenis";
export type Scope =
  | "home"
  | "gallery"
  | "category"
  | "location"
  | "about"
  | "global";

export type HlOverlay = "minimal" | "editorial" | "centered";

export interface RenderConfig {
  gridType: GridType;
  spacing: string;
  theme: "light" | "dark" | "auto";
  hero: { enabled?: boolean; headline?: string } | null;
  // Text-overlay style for the horizontal-scroll detail view.
  overlay: HlOverlay;
}

type SearchParams = Record<string, string | string[] | undefined> | undefined;

// Resolves the page-config a public page should render with, applying an
// admin-only DRAFT override when the Design editor passes `__pc` (live preview).
export async function resolveRenderConfig(
  scope: Scope,
  explicitId: string | null | undefined,
  searchParams: SearchParams,
  defaultGrid: GridType,
): Promise<RenderConfig> {
  const base = await resolvePageConfig(scope, explicitId ?? undefined);
  const cfgJson = (base?.config ?? {}) as { hlOverlay?: HlOverlay };
  const config: RenderConfig = {
    gridType: (base?.gridType as GridType | null) ?? defaultGrid,
    spacing: base?.spacing ?? "normal",
    theme: (base?.theme as RenderConfig["theme"] | null) ?? "auto",
    hero: (base?.hero as RenderConfig["hero"]) ?? null,
    overlay: cfgJson.hlOverlay ?? "minimal",
  };

  const rawParam = searchParams?.[PREVIEW_PARAM];
  const raw = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  if (!raw) return config;

  // Drafts apply only for authenticated admins (the design previewer).
  const session = await getSession();
  if (!session) return config;

  const draft = decodePreview(raw);
  if (!draft) return config;
  return {
    gridType: draft.gridType ?? config.gridType,
    spacing: draft.spacing ?? config.spacing,
    theme: draft.theme ?? config.theme,
    hero: draft.hero !== undefined ? draft.hero : config.hero,
    overlay: draft.overlay ?? config.overlay,
  };
}
