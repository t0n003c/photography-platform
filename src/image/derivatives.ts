import { webSafe } from "@/src/image/exif";

// Responsive variant ladder (docs/MEDIA-ARCHITECTURE.md). Never upscale past
// the original's width — enforced in Phase 2 when widths are known.
export const SIZE_BUCKETS = [200, 400, 800, 1600, 2400] as const;
export type SizeBucket = (typeof SIZE_BUCKETS)[number];

export const FORMATS = ["avif", "webp", "jpeg"] as const;
export type VariantFormat = (typeof FORMATS)[number];

export interface GeneratedVariant {
  format: VariantFormat;
  width: number;
  body: Buffer;
}

// Phase-1 reference implementation for a single variant; the worker batches
// the full matrix (buckets × formats) in Phase 2.
export async function generateVariant(
  input: Buffer,
  width: SizeBucket,
  format: VariantFormat,
): Promise<GeneratedVariant> {
  const pipeline = webSafe(input).resize(width, undefined, {
    withoutEnlargement: true,
  });
  const encoded =
    format === "avif"
      ? pipeline.avif({ quality: 55 })
      : format === "webp"
        ? pipeline.webp({ quality: 72 })
        : pipeline.jpeg({ quality: 80, mozjpeg: true });
  const body = await encoded.toBuffer();
  return { format, width, body };
}
