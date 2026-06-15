import archiver from "archiver";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { download, galleryPhoto, favorite, photo } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import type { BuildZipJob } from "@/src/queue/jobs/zip";

// Build a ZIP of ORIGINAL, full-quality files for a client-gallery download.
// Selection is "favorites" or "all" (stored in download.variant). The archive
// is held in memory then stored; bounded by MAX_PHOTOS (streaming is a future
// improvement for very large galleries).
const ZIP_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PHOTOS = 500;

function safeName(name: string, index: number): string {
  const cleaned = name.replace(/[/\\\x00-\x1f]/g, "_") || "photo";
  return `${String(index + 1).padStart(3, "0")}-${cleaned}`;
}

export async function buildZip(data: BuildZipJob): Promise<void> {
  const storage = getStorage();
  const rows = await db
    .select()
    .from(download)
    .where(eq(download.id, data.downloadId))
    .limit(1);
  const d = rows[0];
  if (!d) throw new Error(`download ${data.downloadId} not found`);
  if (!d.galleryId) throw new Error("download has no gallery");

  await db
    .update(download)
    .set({ status: "building" })
    .where(eq(download.id, d.id));

  try {
    let photoRows: { photo: typeof photo.$inferSelect }[];
    if (d.variant === "favorites" && d.grantId) {
      photoRows = await db
        .select({ photo })
        .from(favorite)
        .innerJoin(photo, eq(favorite.photoId, photo.id))
        .where(and(eq(favorite.grantId, d.grantId), isNull(photo.deletedAt)));
    } else {
      photoRows = await db
        .select({ photo })
        .from(galleryPhoto)
        .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
        .where(
          and(
            eq(galleryPhoto.galleryId, d.galleryId),
            eq(photo.processingStatus, "ready"),
            isNull(photo.deletedAt),
          ),
        )
        .orderBy(asc(galleryPhoto.sortOrder));
    }

    const photos = photoRows.map((r) => r.photo).slice(0, MAX_PHOTOS);
    if (photos.length === 0) throw new Error("nothing to archive");

    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    const finished = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("error", reject);
    });

    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i]!;
      const buf = await storage.get(ph.originalStorageKey);
      archive.append(buf, { name: safeName(ph.filename, i) });
    }
    await archive.finalize();
    await finished;

    const zipBuffer = Buffer.concat(chunks);
    const key = `downloads/${d.id}.zip`;
    await storage.put(key, zipBuffer, { contentType: "application/zip" });

    await db
      .update(download)
      .set({
        status: "ready",
        resultStorageKey: key,
        byteSize: zipBuffer.byteLength,
        expiresAt: new Date(Date.now() + ZIP_TTL_MS),
      })
      .where(eq(download.id, d.id));
  } catch (err) {
    await db
      .update(download)
      .set({ status: "failed" })
      .where(eq(download.id, d.id));
    throw err;
  }
}
