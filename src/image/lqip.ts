import sharp from "sharp";

// Tiny blurred placeholder (LQIP) stored on the photo row to avoid CLS.
// Phase 2 may switch/add blurhash; the contract (a data URI string) stays.
export async function generateLqip(input: Buffer): Promise<string> {
  const buf = await sharp(input)
    .rotate()
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();
  return `data:image/webp;base64,${buf.toString("base64")}`;
}
