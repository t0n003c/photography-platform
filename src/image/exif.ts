import sharp from "sharp";
import exifReader from "exif-reader";

// EXIF policy (MEDIA-ARCHITECTURE.md): preserve EXIF on the ORIGINAL, but bake
// orientation + drop ALL metadata (incl. GPS) on web variants via re-encode.
// We extract a normalized subset into the DB for display; GPS stays admin-only
// (never included in the public photo DTO).

export interface ExtractedMetadata {
  width?: number;
  height?: number;
  format?: string;
  orientation?: number;
  space?: string;
  exif?: Buffer;
}

export async function extractMetadata(
  input: Buffer,
): Promise<ExtractedMetadata> {
  const meta = await sharp(input).metadata();
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    orientation: meta.orientation,
    space: meta.space,
    exif: meta.exif,
  };
}

/** Web-safe pipeline base: normalise orientation, drop all metadata (incl. GPS). */
export function webSafe(input: Buffer): sharp.Sharp {
  return sharp(input).rotate(); // .rotate() bakes EXIF orientation; metadata is dropped on encode
}

// ── EXIF extraction ──────────────────────────────────────────────────────────
export interface NormalizedExif {
  captureDate: Date | null;
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number;
  fNumber?: number;
  exposureTime?: number;
  iso?: number;
  orientation?: number;
  gps?: { lat: number; lng: number };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function dmsToDecimal(v: unknown, ref: unknown): number | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const [d, m, s] = v as number[];
  let dec = d + m / 60 + s / 3600;
  if (ref === "S" || ref === "W") dec = -dec;
  return Number.isFinite(dec) ? dec : undefined;
}

type ExifSections = {
  Image?: Record<string, unknown>;
  Photo?: Record<string, unknown>;
  GPSInfo?: Record<string, unknown>;
};

export function parseExif(exifBuffer?: Buffer): NormalizedExif {
  if (!exifBuffer || exifBuffer.length === 0) return { captureDate: null };
  try {
    const r = exifReader(exifBuffer) as ExifSections;
    const image = r.Image ?? {};
    const photo = r.Photo ?? {};
    const gps = r.GPSInfo ?? {};

    const rawDate = photo.DateTimeOriginal ?? image.DateTime ?? null;
    const captureDate =
      rawDate instanceof Date
        ? rawDate
        : typeof rawDate === "string"
          ? new Date(rawDate)
          : null;

    const isoRaw = photo.ISOSpeedRatings ?? photo.PhotographicSensitivity;
    const iso = Array.isArray(isoRaw) ? num(isoRaw[0]) : num(isoRaw);

    const lat = dmsToDecimal(gps.GPSLatitude, gps.GPSLatitudeRef);
    const lng = dmsToDecimal(gps.GPSLongitude, gps.GPSLongitudeRef);

    return {
      captureDate:
        captureDate && !Number.isNaN(captureDate.getTime()) ? captureDate : null,
      make: str(image.Make),
      model: str(image.Model),
      lens: str(photo.LensModel),
      focalLength: num(photo.FocalLength),
      fNumber: num(photo.FNumber),
      exposureTime: num(photo.ExposureTime),
      iso,
      orientation: num(image.Orientation),
      gps: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    };
  } catch {
    return { captureDate: null };
  }
}
