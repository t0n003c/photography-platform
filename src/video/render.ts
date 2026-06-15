import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  selectComposition,
  renderMedia,
} from "@remotion/renderer";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db/client";
import { gallery, galleryPhoto, photo, photoVariant } from "@/src/db/schema";
import { getStorage } from "@/src/storage";

// Mirrors the Remotion composition's input shape (kept decoupled — the remotion/
// project is bundled separately by @remotion/bundler, not the app tsc).
interface SlideFrame {
  file: string;
  width: number;
  height: number;
}

// Renders a slideshow MP4 from a gallery's photos with Remotion. Worker-only:
// pulls webp variants from storage into a temp public dir, bundles the Remotion
// project against it, renders, and stores the result. Requires the Chromium-
// enabled worker image (VIDEO_RENDER_ENABLED + INSTALL_REMOTION_DEPS build arg).
const MAX_PHOTOS = 60;

export async function renderGalleryVideo(data: {
  galleryId: string;
}): Promise<void> {
  const storage = getStorage();
  const rows = await db
    .select()
    .from(gallery)
    .where(eq(gallery.id, data.galleryId))
    .limit(1);
  const g = rows[0];
  if (!g) throw new Error(`gallery ${data.galleryId} not found`);

  await db
    .update(gallery)
    .set({ videoStatus: "rendering" })
    .where(eq(gallery.id, g.id));

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-"));
  const publicDir = path.join(workDir, "public");
  await fs.mkdir(publicDir, { recursive: true });

  try {
    const photoRows = await db
      .select({ photo })
      .from(galleryPhoto)
      .innerJoin(photo, eq(galleryPhoto.photoId, photo.id))
      .where(
        and(
          eq(galleryPhoto.galleryId, g.id),
          eq(photo.processingStatus, "ready"),
          isNull(photo.deletedAt),
        ),
      )
      .orderBy(asc(galleryPhoto.sortOrder))
      .limit(MAX_PHOTOS);
    if (photoRows.length === 0) throw new Error("gallery has no ready photos");

    const frames: SlideFrame[] = [];
    for (let i = 0; i < photoRows.length; i++) {
      const p = photoRows[i]!.photo;
      const variants = await db
        .select()
        .from(photoVariant)
        .where(eq(photoVariant.photoId, p.id));
      const pick =
        variants.find((v) => v.format === "webp" && v.sizeBucket === "large") ??
        variants.find((v) => v.format === "webp" && v.sizeBucket === "medium") ??
        variants.find((v) => v.format === "jpeg") ??
        variants[0];
      if (!pick) continue;
      const bytes = await storage.get(pick.storageKey);
      const file = `f${i}.${pick.format === "jpeg" ? "jpg" : "webp"}`;
      await fs.writeFile(path.join(publicDir, file), bytes);
      frames.push({ file, width: pick.width, height: pick.height });
    }
    if (frames.length === 0) throw new Error("no usable variants for video");

    await ensureBrowser();
    const serveUrl = await bundle({
      entryPoint: path.join(process.cwd(), "remotion", "index.ts"),
      publicDir,
    });
    const inputProps = { frames, title: g.title };
    const composition = await selectComposition({
      serveUrl,
      id: "GallerySlideshow",
      inputProps,
    });
    const outPath = path.join(workDir, "out.mp4");
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
    });

    const buf = await fs.readFile(outPath);
    const key = `videos/${g.id}.mp4`;
    await storage.put(key, buf, { contentType: "video/mp4" });

    await db
      .update(gallery)
      .set({
        videoStatus: "ready",
        videoStorageKey: key,
        videoGeneratedAt: new Date(),
      })
      .where(eq(gallery.id, g.id));
  } catch (err) {
    await db
      .update(gallery)
      .set({ videoStatus: "failed" })
      .where(eq(gallery.id, g.id));
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
