---
name: gallery-layout
description: Apply when working on the data-driven gallery/portfolio layout system — the admin layout editor, the public render path, the page_config/layout DB rows, src/layout-config/* descriptors, or components/gallery/* that consume them. Use it to keep the admin layout manager and the public site in sync via one typed contract.
---

# Gallery Layout Contract

The layout of every public surface (home, gallery, category, location, about) is **data, not hardcoded JSX**. The admin layout manager writes a layout descriptor; `components/gallery/` renders it data-driven. Both sides depend on **one typed contract** in `src/layout-config/` so they cannot drift. Derived from `docs/DATA-MODEL.md` §12 (`layout` / `page_config`) and `docs/FOLDER-STRUCTURE.md` (`src/layout-config/`).

## 1. Where things live
- **`src/layout-config/`** — the typed layout descriptor types + Zod schema + defaults + a parse/normalize/resolve function. **Single source of truth shared by admin and public.**
- **`components/gallery/`** — presentation only; renders from a resolved descriptor. Adding a layout = adding config + a renderer branch, never rewriting call sites.
- **DB** — `layout` (catalog of layout *types*) and `page_config` (per-surface instance) tables persist the choice.

## 2. DB shape (authoritative)
### `layout` — catalog of layout types
`id` PK · `key` UNIQUE ∈ {`masonry`, `justified`, `uniform-grid`} · `name` · `schema` jsonb (JSON schema of allowed config keys) · timestamps.

### `page_config` — per-surface instance
| Field | Type | Notes |
|---|---|---|
| `id` | text PK | |
| `scope` | text NOT NULL | `home`\|`gallery`\|`category`\|`location`\|`about`\|`global` |
| `layout_id` | FK → layout, NULL | chosen layout type |
| `grid_type` | text NULL | resolved `masonry`\|`justified`\|`uniform` |
| `spacing` | text NULL | `tight`\|`normal`\|`spacious` or px |
| `theme` | text NULL | `light`\|`dark`\|`auto` |
| `hero` | jsonb NULL | `{ enabled, photoId, headline, height, overlay }` |
| `config` | jsonb NOT NULL DEFAULT `'{}'` | full per-page JSON (grid columns, gutters, ordering, captions, …) |
| `is_default` | boolean | default for the scope |

Constraints: `INDEX(scope)`; partial `UNIQUE(scope) WHERE is_default` → **exactly one default per scope**. A `gallery` row references its `page_config` via `gallery.page_config_id`.

## 3. The typed descriptor (the contract)
Define this once in `src/layout-config/` and validate the `config` jsonb against it with Zod on **write (admin)** and **read (public)**. Shape (mirrors the DATA-MODEL.md example):

```ts
type GridType = "masonry" | "justified" | "uniform";
type Spacing  = "tight" | "normal" | "spacious"; // or explicit px
type Theme    = "light" | "dark" | "auto";
type Ordering = "manual" | "newest" | "oldest" | "custom";

interface LayoutDescriptor {
  scope: "home" | "gallery" | "category" | "location" | "about" | "global";
  grid: {
    type: GridType;
    columns: { base: number; sm?: number; md?: number; lg?: number; xl?: number };
    gutter: number;            // px
    // justified-only: targetRowHeight; uniform-only: aspectRatio
    targetRowHeight?: number;
    aspectRatio?: number;
  };
  spacing: Spacing;
  theme: Theme;
  hero?: { enabled: boolean; photoId?: string; headline?: string; height?: string; overlay?: number };
  ordering: Ordering;
  coverBehavior?: "first" | "selected" | "auto"; // gallery cover choice (cover_photo_id)
  showCaptions: boolean;
}
```

Canonical `config` jsonb (DATA-MODEL.md §12.2 example):
```json
{
  "grid": { "type": "masonry", "columns": { "base": 1, "md": 2, "xl": 3 }, "gutter": 12 },
  "spacing": "normal",
  "theme": "auto",
  "hero": { "enabled": true, "photoId": "01J...", "headline": "Wild Places", "height": "70vh", "overlay": 0.3 },
  "ordering": "manual",
  "showCaptions": false
}
```

## 4. Contract rules (keep admin ⇄ public in sync)
1. **One schema, both directions.** The admin editor validates against the **same** `src/layout-config/` Zod schema the public renderer parses with. Never define the shape twice.
2. **`grid_type` is the resolved column** of `config.grid.type`; keep them consistent (resolve on write). Public render reads the resolved descriptor, not raw scattered columns.
3. **Every field has a default.** A `resolve()` function fills missing values from per-scope defaults so an empty/partial `config` always renders. Public code never assumes a key exists — it goes through `resolve()`.
4. **Forward-compatible.** Unknown keys in `config` are ignored (not rejected) by the public reader so an older renderer survives a newer admin write; the admin schema gates what can be written. Validate with `.passthrough()`-style tolerance on read, strict on write.
5. **Layout types are a closed catalog.** Adding a layout = new `layout.key` + descriptor branch + a `components/gallery/` renderer; the contract enumerates `GridType`. No free-form grid types.
6. **One default per scope** (DB partial unique). The render path falls back to the scope default when a surface has no explicit `page_config`.
7. **Cover/hero.** `hero` config drives the hero block; `coverBehavior` + `gallery.cover_photo_id` drive the cover thumbnail. Both are part of the descriptor, not ad-hoc props.
8. **Ordering** is descriptor-driven (`manual` uses the explicit gallery_photo ordering join; others sort server-side). Components never re-sort independently.

## Review checklist
- [ ] Admin write and public read share the one `src/layout-config/` schema.
- [ ] `config` validates via Zod; `resolve()` supplies defaults; unknown keys tolerated on read.
- [ ] `grid.type` ∈ closed catalog; matches `grid_type` and a renderer in `components/gallery/`.
- [ ] Exactly one `is_default` per scope; render falls back to it.
- [ ] hero/cover/ordering go through the descriptor, not hardcoded JSX or ad-hoc props.
