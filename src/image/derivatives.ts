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

// AVIF primary, WebP fallback, JPEG last resort (PERFORMANCE.md).
export const FORMATS = ["avif", "webp", "jpeg"] as const;
export type VariantFormat = (typeof FORMATS)[number];

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
    format === "avif"
      ? pipeline.avif({ quality: 55 })
      : format === "webp"
        ? pipeline.webp({ quality: 72 })
        : pipeline.jpeg({ quality: 80, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  return {
    format,
    sizeBucket: bucket.name,
    width: info.width,
    height: info.height,
    body: data,
  };
}
