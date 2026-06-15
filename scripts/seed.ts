import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import {
  user,
  layout,
  collection,
  location,
  pageConfig,
} from "@/src/db/schema";
import { auth } from "@/src/auth";
import { newId } from "@/src/lib/id";

// Idempotent seed: owner account + layout catalog + starter categories/locations
// + default page configs. Run: npm run db:seed
async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "owner@studio.local";
  const ownerPassword =
    process.env.SEED_OWNER_PASSWORD ?? "change-me-now-please-12";

  // ── Owner ──────────────────────────────────────────────────────────────────
  const existing = await db
    .select()
    .from(user)
    .where(eq(user.email, ownerEmail))
    .limit(1);
  if (existing.length === 0) {
    await auth.api.signUpEmail({
      body: { email: ownerEmail, password: ownerPassword, name: "Studio Owner" },
    });
    await db.update(user).set({ role: "owner" }).where(eq(user.email, ownerEmail));
    console.log(`[seed] created owner ${ownerEmail}`);
  } else {
    console.log(`[seed] owner ${ownerEmail} already exists`);
  }

  // ── Layout catalog ───────────────────────────────────────────────────────--
  const layouts = [
    { key: "masonry", name: "Masonry" },
    { key: "justified", name: "Justified rows" },
    { key: "uniform-grid", name: "Uniform grid" },
  ];
  for (const l of layouts) {
    await db
      .insert(layout)
      .values({ id: newId(), key: l.key, name: l.name })
      .onConflictDoNothing({ target: layout.key });
  }

  // ── Categories ──────────────────────────────────────────────────────────--
  const categories = [
    { slug: "portraits", name: "Portraits" },
    { slug: "events", name: "Events" },
    { slug: "nature", name: "Nature" },
  ];
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]!;
    await db
      .insert(collection)
      .values({ id: newId(), slug: c.slug, name: c.name, sortOrder: i })
      .onConflictDoNothing({ target: collection.slug });
  }

  // ── Locations ───────────────────────────────────────────────────────────--
  const locations = [
    { slug: "arkansas", name: "Arkansas", region: "USA" },
    { slug: "colorado", name: "Colorado", region: "USA" },
    { slug: "seattle", name: "Seattle", region: "USA" },
  ];
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]!;
    await db
      .insert(location)
      .values({
        id: newId(),
        slug: loc.slug,
        name: loc.name,
        region: loc.region,
        sortOrder: i,
      })
      .onConflictDoNothing({ target: location.slug });
  }

  // ── Default page configs (one default per scope) ───────────────────────────
  const scopes = ["home", "gallery", "category", "location", "about"] as const;
  for (const scope of scopes) {
    const present = await db
      .select({ id: pageConfig.id })
      .from(pageConfig)
      .where(eq(pageConfig.scope, scope))
      .limit(1);
    if (present.length === 0) {
      await db.insert(pageConfig).values({
        id: newId(),
        scope,
        gridType: scope === "category" ? "masonry" : "justified",
        spacing: "normal",
        theme: "auto",
        isDefault: true,
        config: {},
      });
    }
  }

  console.log("[seed] done");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
