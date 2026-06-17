import { eq, inArray, desc, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { page, collection, location, photo, menu, menuItem } from "@/src/db/schema";
import { ensureMenusSeeded } from "@/src/db/queries/menus";
import { newId } from "@/src/lib/id";

// Seeds a set of example builder pages (and a nested "Examples" menu) that show
// off the page-builder block palette + the opt-in cinematic effects, using the
// photos/categories already in the database. Idempotent: re-running replaces the
// demo pages and menu subtree. Run inside the worker container:
//   docker compose run --rm worker npx tsx scripts/seed-demo.ts

type Block = Record<string, unknown>;

async function main() {
  // ── Gather real content to reference ──────────────────────────────────────
  const cats = await db
    .select({ id: collection.id, slug: collection.slug, name: collection.name })
    .from(collection)
    .where(eq(collection.isPublished, true));
  const locs = await db
    .select({ id: location.id, slug: location.slug, name: location.name })
    .from(location)
    .where(eq(location.isPublished, true));
  const photos = await db
    .select({ id: photo.id })
    .from(photo)
    .where(isNull(photo.deletedAt))
    .orderBy(desc(photo.createdAt))
    .limit(24);

  const photoIds = photos.map((p) => p.id);
  if (photoIds.length === 0) {
    console.error("[seed-demo] no photos found — upload some first.");
    process.exit(1);
  }
  const pick = (i: number) => photoIds[i % photoIds.length];
  const cat = (i: number) => cats[i % Math.max(1, cats.length)];
  const loc = (i: number) => locs[i % Math.max(1, locs.length)];

  // Block id generator (unique per page).
  const mk = () => {
    let n = 0;
    return () => `d${n++}`;
  };

  // ── Page definitions ──────────────────────────────────────────────────────
  type DemoPage = { slug: string; title: string; type: string; blocks: Block[] };
  const pages: DemoPage[] = [];

  // 1) Showcase — a broad sampler (banner WebGL distortion, galleries, columns)
  {
    const id = mk();
    pages.push({
      slug: "showcase",
      title: "Showcase",
      type: "landing",
      blocks: [
        { id: id(), type: "banner", source: "featured", photoId: null, headline: "The Showcase", subhead: "Everything the page builder can do", ctaLabel: "See the blocks", ctaHref: "/design-samples", height: "tall", effect: "webgl-distortion" },
        { id: id(), type: "heading", text: "Featured work", level: 2, align: "center" },
        { id: id(), type: "subheading", text: "A masonry wall pulled from your featured photos", align: "center" },
        { id: id(), type: "gallery", source: "featured", targetId: null, gridType: "masonry", spacing: "airy", limit: 12, effect: "none" },
        { id: id(), type: "columns", gap: "airy", columns: [
          [
            { id: id(), type: "heading", text: "Crafted with care", level: 3, align: "left" },
            { id: id(), type: "richtext", text: "Two-column sections mix words and images.\n\nEach column can hold headings, text, images or quotes — arrange them however the story needs.", align: "left" },
          ],
          [ { id: id(), type: "image", photoId: pick(2), width: "full", rounded: true, caption: "An image block" } ],
        ] },
        ...(cats.length ? [
          { id: id(), type: "heading", text: cat(0).name, level: 2, align: "center" } as Block,
          { id: id(), type: "gallery", source: "category", targetId: cat(0).id, gridType: "justified", spacing: "normal", limit: 9, effect: "none" } as Block,
        ] : []),
        { id: id(), type: "quote", text: "Photography is the story I fail to put into words.", cite: "Destin Sparks" },
        { id: id(), type: "cta", headline: "Like what you see?", body: "These pages are fully editable in Admin → Pages.", buttonLabel: "Get in touch", buttonHref: "/contact" },
      ],
    });
  }

  // 2) Cinematic — the scroll-driven 3D gallery (the star effect)
  {
    const id = mk();
    pages.push({
      slug: "cinematic",
      title: "Cinematic",
      type: "portfolio",
      blocks: [
        { id: id(), type: "banner", source: "featured", photoId: null, headline: "Cinematic Scroll", subhead: "Scroll to fly through the frames in 3D", height: "full", effect: "none" },
        { id: id(), type: "heading", text: "Keep scrolling ↓", level: 2, align: "center" },
        { id: id(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", limit: 12, effect: "cinematic-3d-scroll" },
        { id: id(), type: "spacer", size: "lg" },
        { id: id(), type: "cta", headline: "That was the cinematic effect", body: "Turn it on for any gallery block under its Effect setting.", buttonLabel: "Back to the showcase", buttonHref: "/showcase" },
      ],
    });
  }

  // 3) Design samples — kitchen sink of every block type
  {
    const id = mk();
    pages.push({
      slug: "design-samples",
      title: "Design samples",
      type: "standard",
      blocks: [
        { id: id(), type: "heading", text: "Design samples", level: 1, align: "left" },
        { id: id(), type: "subheading", text: "Every block type on one page", align: "left" },
        { id: id(), type: "richtext", text: "This page exists to show the building blocks. Headings, text, quotes, columns, images, dividers and three gallery layouts all live below.\n\nMix and match them to compose any page.", align: "left" },
        { id: id(), type: "divider" },
        { id: id(), type: "heading", text: "Three columns", level: 2, align: "left" },
        { id: id(), type: "columns", gap: "normal", columns: [
          [ { id: id(), type: "heading", text: "One", level: 3, align: "left" }, { id: id(), type: "richtext", text: "First column copy.", align: "left" } ],
          [ { id: id(), type: "heading", text: "Two", level: 3, align: "left" }, { id: id(), type: "richtext", text: "Second column copy.", align: "left" } ],
          [ { id: id(), type: "heading", text: "Three", level: 3, align: "left" }, { id: id(), type: "richtext", text: "Third column copy.", align: "left" } ],
        ] },
        { id: id(), type: "quote", text: "A quote block adds a moment of pause.", cite: "The Studio" },
        { id: id(), type: "image", photoId: pick(5), width: "wide", rounded: true, caption: "A wide image block" },
        { id: id(), type: "heading", text: "Uniform grid", level: 2, align: "center" },
        { id: id(), type: "gallery", source: "featured", targetId: null, gridType: "uniform", spacing: "tight", limit: 8, effect: "none" },
        { id: id(), type: "heading", text: "Justified grid", level: 2, align: "center" },
        { id: id(), type: "gallery", source: "featured", targetId: null, gridType: "justified", spacing: "normal", limit: 8, effect: "none" },
        { id: id(), type: "categoryIndex", title: "By category" },
        { id: id(), type: "locationIndex", title: "By location" },
        { id: id(), type: "instagram", title: "From the field", count: 6 },
        { id: id(), type: "cta", headline: "Compose your own", buttonLabel: "Open the builder", buttonHref: "/showcase" },
      ],
    });
  }

  // 4) The Studio — an editorial about-style page
  {
    const id = mk();
    pages.push({
      slug: "studio",
      title: "The Studio",
      type: "about",
      blocks: [
        { id: id(), type: "banner", source: "featured", photoId: null, headline: "The Studio", subhead: "Portraits, places, and the light in between", height: "short", effect: "none" },
        { id: id(), type: "columns", gap: "airy", columns: [
          [
            { id: id(), type: "heading", text: "Our approach", level: 2, align: "left" },
            { id: id(), type: "richtext", text: "We make unhurried, considered images and deliver them with care.\n\nEvery commission is organised by category and by the places it was made.", align: "left" },
          ],
          [ { id: id(), type: "image", photoId: pick(7), width: "full", rounded: true } ],
        ] },
        { id: id(), type: "quote", text: "We don't take photographs, we make them.", cite: "Ansel Adams" },
        ...(locs.length ? [
          { id: id(), type: "heading", text: `On location: ${loc(0).name}`, level: 2, align: "center" } as Block,
          { id: id(), type: "gallery", source: "location", targetId: loc(0).id, gridType: "justified", spacing: "normal", limit: 9, effect: "none" } as Block,
        ] : []),
        { id: id(), type: "cta", headline: "Start a conversation", buttonLabel: "Contact", buttonHref: "/contact" },
      ],
    });
  }

  // ── Replace demo pages ────────────────────────────────────────────────────
  const slugs = pages.map((p) => p.slug);
  await db.delete(page).where(inArray(page.slug, slugs));
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    await db.insert(page).values({
      id: newId(),
      slug: p.slug,
      title: p.title,
      type: p.type as typeof page.$inferInsert.type,
      status: "published",
      blocks: p.blocks,
      sortOrder: 10 + i,
      publishedAt: new Date(),
    });
    console.log(`[seed-demo] page  /${p.slug}  (${p.blocks.length} blocks)`);
  }

  // ── Nested "Examples" menu under primary ──────────────────────────────────
  await ensureMenusSeeded();
  const primary = (await db.select().from(menu).where(eq(menu.key, "primary")).limit(1))[0];
  if (primary) {
    // Remove a previous "Examples" subtree (cascade clears children).
    await db.delete(menuItem).where(eq(menuItem.label, "Examples"));
    const created = await db
      .select({ id: page.id, slug: page.slug, title: page.title })
      .from(page)
      .where(inArray(page.slug, slugs));
    const bySlug = new Map(created.map((c) => [c.slug, c]));

    const parentId = newId();
    await db.insert(menuItem).values({
      id: parentId,
      menuId: primary.id,
      label: "Examples",
      linkType: "page",
      targetId: bySlug.get("showcase")?.id ?? null,
      sortOrder: 100,
    });
    let order = 0;
    for (const slug of slugs) {
      const pg = bySlug.get(slug);
      if (!pg) continue;
      await db.insert(menuItem).values({
        id: newId(),
        menuId: primary.id,
        parentId,
        label: pg.title,
        linkType: "page",
        targetId: pg.id,
        sortOrder: order++,
      });
    }
    console.log(`[seed-demo] menu  added "Examples" dropdown with ${slugs.length} pages`);
  }

  console.log("\n[seed-demo] done. View:");
  for (const s of slugs) console.log(`  http://localhost:3001/${s}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-demo] failed", err);
  process.exit(1);
});
