import { webSafe } from "@/src/image/exif";

// Responsive variant ladder (MEDIA-ARCHITECTURE.md). Bucket names match the
// `photo_variant.size_bucket` enum. Never upscale: buckets wider than the
// original are skipped by the pipeline (except the smallest).
export const BUCKETS = [
  { name: "thumb", width: 400 },
  { name: "small", width: 800 },
  { name: "medium", width: 1600 },
  { name: "large", width: 2400 },
  { name: "xlarge", width: 3840 },
] as const;

export type SizeBucket = (typeof BUCKETS)[number]["name"];

// App delivery is WebP-primary (ADR-0019): WebP at every responsive size for
// small, fast, high-quality display + storage savings, plus ONE JPEG fallback
// (at the FALLBACK_BUCKET) for the <img> tag and the rare non-WebP client.
// Originals are preserved untouched for full-quality client downloads.
export const FORMATS = ["webp", "jpeg"] as const;
export type VariantFormat = (typeof FORMATS)[number];

// JPEG fallback is generated only at this size (kept modest to limit storage).
export const FALLBACK_BUCKET = "large";

// Quality tuned for near-visually-lossless at meaningfully smaller size.
const WEBP_QUALITY = 82;
const JPEG_QUALITY = 82;

export interface GeneratedVariant {
  format: VariantFormat;
  sizeBucket: SizeBucket;
  width: number;
  height: number;
  body: Buffer;
}

export async function generateVariant(
  input: Buffer,
  bucket: (typeof BUCKETS)[number],
  format: VariantFormat,
): Promise<GeneratedVariant> {
  const pipeline = webSafe(input).resize({
    width: bucket.width,
    withoutEnlargement: true,
  });
  const encoded =
    format === "webp"
      ? pipeline.webp({ quality: WEBP_QUALITY, effort: 4 })
      : pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return {
    format,
    sizeBucket: bucket.name,
    width: info.width,
    height: info.height,
    body: data,
  };
}
