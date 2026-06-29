// Config-driven layout contract shared by the admin layout manager and the
// public renderer (components/gallery). See .claude/skills/gallery-layout and
// docs/DATA-MODEL.md (page_configs / layouts). Types only in Phase 1.

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
export type Spacing = "tight" | "normal" | "airy";

export interface HeroConfig {
  enabled: boolean;
  photoId?: string;
  headline?: string;
}

export interface LayoutDescriptor {
  gridType: GridType;
  spacing: Spacing;
  /** Target row height (justified) or column count hint (uniform/masonry). */
  density?: number;
  hero?: HeroConfig;
}

export const DEFAULT_LAYOUT: LayoutDescriptor = {
  gridType: "justified",
  spacing: "normal",
  density: 280,
  hero: { enabled: false },
};
