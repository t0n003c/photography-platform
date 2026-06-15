import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo, photoVariant } from "@/src/db/schema";
import { getStorage } from "@/src/storage";
import { variantKey } from "@/src/storage/keys";
import { BUCKETS, FORMATS, generateVariant } from "@/src/image/derivatives";
import { generateLqip } from "@/src/image/lqip";
import { extractMetadata } from "@/src/image/exif";
import { MAX_PIXELS } from "@/src/image/validate";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import type { ProcessImageJob } from "@/src/queue/jobs/image";

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

// The async pipeline (API-DESIGN §6.2). Idempotent: the BullMQ jobId is the
// photo id and variant upserts key on (photo, format, bucket), so retries and
// reprocessing converge. Originals are read but never mutated.
export async function processImage(data: ProcessImageJob): Promise<void> {
  const storage = getStorage();
  const rows = await db
    .select()
    .from(photo)
    .where(eq(photo.id, data.photoId))
    .limit(1);
  const p = rows[0];
  if (!p) throw new Error(`photo ${data.photoId} not found`);

  await db
    .update(photo)
    .set({ processingStatus: "processing" })
    .where(eq(photo.id, p.id));

  try {
    const original = await storage.get(data.originalKey);

    const meta = await extractMetadata(original);
    const width = meta.width ?? p.width;
    const height = meta.height ?? p.height;
    if (width * height > MAX_PIXELS) {
      throw new Error("image exceeds maximum pixel budget");
    }

    const stats = await sharp(original).stats();
    const { r, g, b } = stats.dominant;
    const dominantColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    const lqip = await generateLqip(original);

    // Skip buckets wider than the original (never upscale), keep the smallest.
    const buckets = BUCKETS.filter((bk, i) => bk.width <= width || i === 0);

    for (const bucket of buckets) {
      for (const format of FORMATS) {
        const v = await generateVariant(original, bucket, format);
        const key = variantKey(p.id, v.sizeBucket, v.format);
        await storage.put(key, v.body, {
          contentType: `image/${format}`,
          cacheControl: "public, max-age=31536000, immutable",
        });
        await db
          .insert(photoVariant)
          .values({
            id: newId(),
            photoId: p.id,
            format: v.format,
            sizeBucket: v.sizeBucket,
            storageKey: key,
            width: v.width,
            height: v.height,
            byteSize: v.body.byteLength,
          })
          .onConflictDoUpdate({
            target: [
              photoVariant.photoId,
              photoVariant.format,
              photoVariant.sizeBucket,
            ],
            set: {
              storageKey: key,
              width: v.width,
              height: v.height,
              byteSize: v.body.byteLength,
            },
          });
      }
    }

    await db
      .update(photo)
      .set({
        processingStatus: "ready",
        width,
        height,
        dominantColor,
        lqip,
        exif: {
          orientation: meta.orientation ?? null,
          space: meta.space ?? null,
          format: meta.format ?? null,
        },
        processingError: null,
      })
      .where(eq(photo.id, p.id));

    await writeAudit({
      actorId: p.ownerId,
      actorType: "system",
      action: "photo.processed",
      entityType: "photo",
      entityId: p.id,
      metadata: { variants: buckets.length * FORMATS.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(photo)
      .set({ processingStatus: "failed", processingError: message })
      .where(eq(photo.id, p.id));
    throw err;
  }
}
