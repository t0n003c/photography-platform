// Upload validation (SECURITY.md §6). Never trust the client Content-Type or
// extension: sniff magic bytes. SVG is rejected (script vector). Served variants
// are always re-encoded by the sharp pipeline.

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_PIXELS = 100_000_000; // decompression-bomb guard
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

interface Signature {
  mime: AllowedMime;
  ext: string;
  test: (b: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    mime: "image/avif",
    ext: "avif",
    test: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 4, 8) === "ftyp" &&
      /avif|avis/.test(b.toString("ascii", 8, 12)),
  },
  {
    mime: "image/tiff",
    ext: "tiff",
    test: (b) =>
      (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00),
  },
];

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

/** Detect a supported image by magic bytes, or null if unsupported. */
export function sniffImage(buf: Buffer): { mime: AllowedMime; ext: string } | null {
  for (const sig of SIGNATURES) {
    if (sig.test(buf)) return { mime: sig.mime, ext: sig.ext };
  }
  return null;
}
