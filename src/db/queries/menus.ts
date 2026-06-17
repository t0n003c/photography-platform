import { eq, inArray, asc } from "drizzle-orm";
import { db } from "@/src/db/client";
import { menu, menuItem, collection, location, gallery, page } from "@/src/db/schema";
import { newId } from "@/src/lib/id";
import { cached, invalidate } from "@/src/lib/cache";

export type MenuKey = "primary" | "footer";

export interface ResolvedMenuItem {
  id: string;
  label: string;
  href: string;
  external: boolean;
  openInNewTab: boolean;
  children: ResolvedMenuItem[];
}

const CACHE_KEY = (key: string) => `pub:menu:${key}`;

// Fallback nav used when a menu has no items yet (keeps the public site working
// before the admin customizes it). Mirrors the original hardcoded links.
const DEFAULT_ITEMS: ResolvedMenuItem[] = [
  { id: "d-home", label: "Portfolio", href: "/", external: false, openInNewTab: false, children: [] },
  { id: "d-cat", label: "Categories", href: "/categories", external: false, openInNewTab: false, children: [] },
  { id: "d-loc", label: "Locations", href: "/locations", external: false, openInNewTab: false, children: [] },
  { id: "d-about", label: "About", href: "/about", external: false, openInNewTab: false, children: [] },
  { id: "d-contact", label: "Contact", href: "/contact", external: false, openInNewTab: false, children: [] },
];

type ItemRow = typeof menuItem.$inferSelect;

async function resolveSlugMaps(items: ItemRow[]) {
  const byType = (t: string) =>
    items.filter((i) => i.linkType === t && i.targetId).map((i) => i.targetId!);
  const catIds = byType("category");
  const locIds = byType("location");
  const galIds = byType("gallery");
  const pageIds = byType("page");

  const [cats, locs, gals, pages] = await Promise.all([
    catIds.length
      ? db.select({ id: collection.id, slug: collection.slug }).from(collection).where(inArray(collection.id, catIds))
      : Promise.resolve([] as { id: string; slug: string }[]),
    locIds.length
      ? db.select({ id: location.id, slug: location.slug }).from(location).where(inArray(location.id, locIds))
      : Promise.resolve([] as { id: string; slug: string }[]),
    galIds.length
      ? db.select({ id: gallery.id, slug: gallery.slug }).from(gallery).where(inArray(gallery.id, galIds))
      : Promise.resolve([] as { id: string; slug: string }[]),
    pageIds.length
      ? db.select({ id: page.id, slug: page.slug }).from(page).where(inArray(page.id, pageIds))
      : Promise.resolve([] as { id: string; slug: string }[]),
  ]);

  return {
    category: new Map(cats.map((c) => [c.id, c.slug])),
    location: new Map(locs.map((l) => [l.id, l.slug])),
    gallery: new Map(gals.map((g) => [g.id, g.slug])),
    page: new Map(pages.map((p) => [p.id, p.slug])),
  };
}

function hrefFor(
  item: ItemRow,
  maps: Awaited<ReturnType<typeof resolveSlugMaps>>,
): string {
  switch (item.linkType) {
    case "home":
      return "/";
    case "url":
      return item.url || "#";
    case "category": {
      const s = item.targetId && maps.category.get(item.targetId);
      return s ? `/categories/${s}` : "#";
    }
    case "location": {
      const s = item.targetId && maps.location.get(item.targetId);
      return s ? `/locations/${s}` : "#";
    }
    case "gallery": {
      const s = item.targetId && maps.gallery.get(item.targetId);
      return s ? `/galleries/${s}` : "#";
    }
    case "page": {
      const s = item.targetId && maps.page.get(item.targetId);
      return s ? `/${s}` : "#";
    }
    default:
      return "#";
  }
}

function buildTree(
  items: ItemRow[],
  maps: Awaited<ReturnType<typeof resolveSlugMaps>>,
): ResolvedMenuItem[] {
  const nodes = new Map<string, ResolvedMenuItem>();
  for (const it of items) {
    const href = hrefFor(it, maps);
    nodes.set(it.id, {
      id: it.id,
      label: it.label,
      href,
      external: /^https?:\/\//i.test(href),
      openInNewTab: it.openInNewTab,
      children: [],
    });
  }
  const roots: ResolvedMenuItem[] = [];
  for (const it of items) {
    const node = nodes.get(it.id)!;
    if (it.parentId && nodes.has(it.parentId)) {
      nodes.get(it.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// Public: resolved, nested, visible-only menu tree (cached). Falls back to the
// default links when the menu has no items.
export async function getMenu(key: MenuKey): Promise<ResolvedMenuItem[]> {
  return cached<ResolvedMenuItem[]>(CACHE_KEY(key), 120, async () => {
    try {
      const m = await db.select().from(menu).where(eq(menu.key, key)).limit(1);
      if (!m[0]) return DEFAULT_ITEMS;
      const items = await db
        .select()
        .from(menuItem)
        .where(eq(menuItem.menuId, m[0].id))
        .orderBy(asc(menuItem.sortOrder));
      const visible = items.filter((i) => i.isVisible);
      if (visible.length === 0) return DEFAULT_ITEMS;
      const maps = await resolveSlugMaps(visible);
      return buildTree(visible, maps);
    } catch {
      return DEFAULT_ITEMS;
    }
  });
}

export async function invalidateMenu(key: MenuKey): Promise<void> {
  await invalidate(CACHE_KEY(key));
}

// ── Admin ────────────────────────────────────────────────────────────────────

const SEED = [
  { label: "Portfolio", linkType: "home" as const, url: null },
  { label: "Categories", linkType: "url" as const, url: "/categories" },
  { label: "Locations", linkType: "url" as const, url: "/locations" },
  { label: "About", linkType: "url" as const, url: "/about" },
  { label: "Contact", linkType: "url" as const, url: "/contact" },
];

// Ensures the primary + footer menus exist, seeding them with the original nav
// the first time so the admin starts from the current site. Idempotent.
export async function ensureMenusSeeded(): Promise<void> {
  for (const key of ["primary", "footer"] as const) {
    const existing = await db.select({ id: menu.id }).from(menu).where(eq(menu.key, key)).limit(1);
    if (existing[0]) continue;
    const menuId = newId();
    await db.insert(menu).values({
      id: menuId,
      key,
      name: key === "primary" ? "Primary navigation" : "Footer",
    });
    await db.insert(menuItem).values(
      SEED.map((s, i) => ({
        id: newId(),
        menuId,
        label: s.label,
        linkType: s.linkType,
        url: s.url,
        sortOrder: i,
      })),
    );
  }
}

export interface AdminMenu {
  id: string;
  key: string;
  name: string;
  items: ItemRow[];
}

export async function listMenusForAdmin(): Promise<AdminMenu[]> {
  await ensureMenusSeeded();
  const menus = await db.select().from(menu).orderBy(asc(menu.key));
  const items = await db.select().from(menuItem).orderBy(asc(menuItem.sortOrder));
  return menus.map((m) => ({
    id: m.id,
    key: m.key,
    name: m.name,
    items: items.filter((i) => i.menuId === m.id),
  }));
}
