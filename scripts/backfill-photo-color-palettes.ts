import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";
import { extractColorPalette } from "@/src/image/colors";
import { getStorage } from "@/src/storage";

async function main() {
  const rows = await db
    .select({ id: photo.id, originalStorageKey: photo.originalStorageKey })
    .from(photo)
    .where(and(eq(photo.processingStatus, "ready"), isNull(photo.deletedAt)));

  const storage = getStorage();
  for (const row of rows) {
    const original = await storage.get(row.originalStorageKey);
    const colorPalette = await extractColorPalette(original);
    await db.update(photo).set({ colorPalette }).where(eq(photo.id, row.id));
    console.log(`[color-palette] ${row.id}: ${colorPalette.join(", ")}`);
  }

  console.log(`[color-palette] updated ${rows.length} photos`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
