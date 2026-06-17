import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db/client";
import { page, photo } from "@/src/db/schema";
import { newId } from "@/src/lib/id";
import { serializePhotos, type PhotoDTO } from "@/src/db/queries/photos";
import type { Block } from "@/src/lib/blocks";

export type PageRow = typeof page.$inferSelect;

// Top-level slugs owned by fixed routes — builder pages may not use these.
export const RESERVED_SLUGS = new Set([
  "admin", "api", "g", "login", "categories", "locations", "galleries",
  "contact", "_next", "manifest.webmanifest", "robots.txt", "sitemap.xml",
  "icon.svg", "sw.js",
]);

export async function getPublishedPageBySlug(slug: string): Promise<PageRow | null> {
  if (RESERVED_SLUGS.has(slug)) return null;
  try {
    const rows = await db
      .select()
      .from(page)
      .where(and(eq(page.slug, slug), eq(page.status, "published")))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getHomePage(): Promise<PageRow | null> {
  try {
    const rows = await db
      .select()
      .from(page)
      .where(and(eq(page.isHome, true), eq(page.status, "published")))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// Photos referenced directly by image/banner blocks, keyed by id.
export async function getPhotosByIds(
  ids: string[],
): Promise<Map<string, PhotoDTO>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(photo).where(inArray(photo.id, ids));
  const dtos = await serializePhotos(rows.filter((r) => !r.deletedAt));
  return new Map(dtos.map((d) => [d.id, d]));
}

// The original /about copy, expressed as builder blocks. Seeded once so the
// page becomes editable while rendering identically.
const ABOUT_BLOCKS: Block[] = [
  { id: "h", type: "heading", text: "About the studio", level: 1, align: "left" },
  {
    id: "p1",
    type: "richtext",
    align: "left",
    text:
      "This studio is a self-hosted home for a working photographer's portfolio, private client galleries, and fine-art prints. Portraits, events, and the wild places in between — captured and delivered with care.\n\nEvery shoot is organised by category and by the places it was made. Clients receive their own private, access-controlled gallery to view, favourite, and download their images, and to order prints.",
  },
  {
    id: "cta",
    type: "cta",
    headline: "",
    buttonLabel: "Start a conversation",
    buttonHref: "/contact",
  },
];

// Idempotently seed the core builder pages (About for now; Home migrates in a
// later step). Lets /about render from the builder with no manual seed step.
export async function ensureCorePagesSeeded(): Promise<void> {
  try {
    const existing = await db
      .select({ id: page.id })
      .from(page)
      .where(eq(page.slug, "about"))
      .limit(1);
    if (existing[0]) return;
    await db.insert(page).values({
      id: newId(),
      slug: "about",
      title: "About",
      type: "about",
      status: "published",
      blocks: ABOUT_BLOCKS,
      publishedAt: new Date(),
    });
  } catch {
    // best-effort; the page falls back to its hardcoded content
  }
}
