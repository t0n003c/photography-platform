import sharp from "sharp";

// Phase 2 implements the full policy from docs/MEDIA-ARCHITECTURE.md:
// preserve EXIF on the ORIGINAL, strip GPS + bake orientation on web variants,
// extract capture date / camera / dimensions into the DB.

export interface ExtractedMetadata {
  width?: number;
  height?: number;
  format?: string;
}

export async function extractMetadata(
  input: Buffer,
): Promise<ExtractedMetadata> {
  const meta = await sharp(input).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
}

/** Web-safe pipeline base: normalise orientation, drop all metadata (incl. GPS). */
export function webSafe(input: Buffer): sharp.Sharp {
  return sharp(input).rotate(); // .rotate() bakes EXIF orientation, then metadata is dropped on encode
}
