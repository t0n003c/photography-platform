import { eq, and, inArray, asc } from "drizzle-orm";
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
  // True when the item has no real destination (linkType "none", or a target
  // that couldn't be resolved). The public nav renders these as inert labels.
  noLink: boolean;
  children: ResolvedMenuItem[];
}

const CACHE_KEY = (key: string) => `pub:menu:${key}`;

// Fallback nav used when a menu has no items yet (keeps the public site working
// before the admin customizes it). Mirrors the original hardcoded links.
const DEFAULT_ITEMS: ResolvedMenuItem[] = [
  { id: "d-home", label: "Portfolio", href: "/", external: false, openInNewTab: false, noLink: false, children: [] },
  { id: "d-cat", label: "Categories", href: "/categories", external: false, openInNewTab: false, noLink: false, children: [] },
  { id: "d-loc", label: "Locations", href: "/locations", external: false, openInNewTab: false, noLink: false, children: [] },
  { id: "d-about", label: "About", href: "/about", external: false, openInNewTab: false, noLink: false, children: [] },
  { id: "d-contact", label: "Contact", href: "/contact", external: false, openInNewTab: false, noLink: false, children: [] },
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
    case "none":
      return "#";
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
      noLink: href === "#",
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

// Public: resolved, nested, visible-only menu tree (cached) for a role's ACTIVE
// preset. Falls back to the default links when no active menu / no items.
export async function getMenu(role: MenuKey): Promise<ResolvedMenuItem[]> {
  return cached<ResolvedMenuItem[]>(CACHE_KEY(role), 120, async () => {
    try {
      const m = await db
        .select()
        .from(menu)
        .where(and(eq(menu.role, role), eq(menu.isActive, true)))
        .limit(1);
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

// Ensures one active primary + footer menu exists, seeding them with the
// original nav the first time so the admin starts from the current site.
// Idempotent (keyed by role).
export async function ensureMenusSeeded(): Promise<void> {
  for (const role of ["primary", "footer"] as const) {
    const existing = await db.select({ id: menu.id }).from(menu).where(eq(menu.role, role)).limit(1);
    if (existing[0]) continue;
    const menuId = newId();
    await db.insert(menu).values({
      id: menuId,
      key: role, // first preset keeps the legacy key === role
      role,
      isActive: true,
      name: role === "primary" ? "Primary navigation" : "Footer",
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
  role: MenuKey;
  isActive: boolean;
  name: string;
  items: ItemRow[];
}

export async function listMenusForAdmin(): Promise<AdminMenu[]> {
  await ensureMenusSeeded();
  const menus = await db.select().from(menu).orderBy(asc(menu.role), asc(menu.name));
  const items = await db.select().from(menuItem).orderBy(asc(menuItem.sortOrder));
  return menus.map((m) => ({
    id: m.id,
    key: m.key,
    role: m.role as MenuKey,
    isActive: m.isActive,
    name: m.name,
    items: items.filter((i) => i.menuId === m.id),
  }));
}

// ── Preset management ─────────────────────────────────────────────────────────

// Create a new (empty, inactive) preset for a role. Returns the new menu id.
export async function createMenuPreset(role: MenuKey, name: string): Promise<string> {
  const id = newId();
  await db.insert(menu).values({ id, key: newId(), role, isActive: false, name });
  return id;
}

export async function renameMenu(id: string, name: string): Promise<void> {
  await db.update(menu).set({ name }).where(eq(menu.id, id));
}

// Make `id` the active preset for its role (deactivates its siblings).
export async function activateMenu(id: string): Promise<MenuKey | null> {
  const rows = await db.select({ role: menu.role }).from(menu).where(eq(menu.id, id)).limit(1);
  const role = rows[0]?.role as MenuKey | undefined;
  if (!role) return null;
  await db.transaction(async (tx) => {
    await tx.update(menu).set({ isActive: false }).where(eq(menu.role, role));
    await tx.update(menu).set({ isActive: true }).where(eq(menu.id, id));
  });
  return role;
}

// Delete a preset. Refuses the active preset, or the last one in a role.
export async function deleteMenuPreset(
  id: string,
): Promise<{ ok: boolean; reason?: "NOT_FOUND" | "ACTIVE" | "ONLY"; role?: MenuKey }> {
  const rows = await db
    .select({ role: menu.role, isActive: menu.isActive })
    .from(menu)
    .where(eq(menu.id, id))
    .limit(1);
  const m = rows[0];
  if (!m) return { ok: false, reason: "NOT_FOUND" };
  if (m.isActive) return { ok: false, reason: "ACTIVE" };
  const role = m.role as MenuKey;
  const siblings = await db.select({ id: menu.id }).from(menu).where(eq(menu.role, role));
  if (siblings.length <= 1) return { ok: false, reason: "ONLY" };
  await db.delete(menu).where(eq(menu.id, id)); // items cascade
  return { ok: true, role };
}

// Deep-copy a preset (items + hierarchy) into a new inactive preset.
export async function duplicateMenu(id: string): Promise<{ id: string; role: MenuKey } | null> {
  const src = await db.select().from(menu).where(eq(menu.id, id)).limit(1);
  if (!src[0]) return null;
  const items = await db
    .select()
    .from(menuItem)
    .where(eq(menuItem.menuId, id))
    .orderBy(asc(menuItem.sortOrder));
  const newMenuId = newId();
  const role = src[0].role as MenuKey;
  await db.insert(menu).values({
    id: newMenuId,
    key: newId(),
    role,
    isActive: false,
    name: `${src[0].name} copy`,
  });
  if (items.length) {
    const idMap = new Map<string, string>();
    for (const it of items) idMap.set(it.id, newId());
    await db.insert(menuItem).values(
      items.map((it) => ({
        id: idMap.get(it.id)!,
        menuId: newMenuId,
        parentId: it.parentId ? idMap.get(it.parentId) ?? null : null,
        label: it.label,
        linkType: it.linkType,
        targetId: it.targetId,
        url: it.url,
        sortOrder: it.sortOrder,
        openInNewTab: it.openInNewTab,
        isVisible: it.isVisible,
      })),
    );
  }
  return { id: newMenuId, role };
}
