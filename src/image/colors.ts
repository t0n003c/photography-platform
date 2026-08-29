import sharp from "sharp";

export type PhotoColorPalette = string[];

type RGB = readonly [number, number, number];

const SAMPLE_SIZE = 32;
const MAX_SWATCHES = 5;
const ITERATIONS = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHex(value: number): string {
  return Math.round(clamp(value, 0, 255))
    .toString(16)
    .padStart(2, "0");
}

function squaredDistance(first: RGB, second: RGB): number {
  return (
    (first[0] - second[0]) ** 2 +
    (first[1] - second[1]) ** 2 +
    (first[2] - second[2]) ** 2
  );
}

function average(points: RGB[]): RGB {
  if (points.length === 0) return [128, 128, 128];
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]],
    [0, 0, 0] as [number, number, number],
  );
  return [total[0] / points.length, total[1] / points.length, total[2] / points.length];
}

function hex(point: RGB): string {
  return `#${toHex(point[0])}${toHex(point[1])}${toHex(point[2])}`;
}

/**
 * Extract a compact, deterministic palette from the actual image pixels.
 *
 * Sharp's `stats().dominant` is useful for a placeholder, but it collapses an
 * entire photograph into one color. A small k-means pass over a 32px sample
 * keeps the major background, subject, and accent colors without making the
 * upload worker do expensive full-resolution analysis.
 */
export async function extractColorPalette(input: Buffer): Promise<PhotoColorPalette> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "inside" })
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = info.channels;
  const pixels: RGB[] = [];
  for (let index = 0; index + 2 < data.length; index += channels) {
    pixels.push([data[index], data[index + 1], data[index + 2]]);
  }
  if (pixels.length === 0) return [];

  const centroids: RGB[] = [pixels[0]];
  while (centroids.length < Math.min(MAX_SWATCHES, pixels.length)) {
    let farthest = pixels[0];
    let farthestDistance = -1;
    for (const pixel of pixels) {
      const distance = Math.min(
        ...centroids.map((centroid) => squaredDistance(pixel, centroid)),
      );
      if (distance > farthestDistance) {
        farthest = pixel;
        farthestDistance = distance;
      }
    }
    centroids.push(farthest);
  }

  let assignments = new Array<number>(pixels.length).fill(0);
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const groups = centroids.map(() => [] as RGB[]);
    assignments = pixels.map((pixel) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, centroidIndex) => {
        const distance = squaredDistance(pixel, centroid);
        if (distance < bestDistance) {
          bestIndex = centroidIndex;
          bestDistance = distance;
        }
      });
      groups[bestIndex].push(pixel);
      return bestIndex;
    });

    groups.forEach((group, index) => {
      if (group.length > 0) centroids[index] = average(group);
    });
  }

  const counts = centroids.map((_, centroidIndex) =>
    assignments.reduce(
      (count, assignment) => count + (assignment === centroidIndex ? 1 : 0),
      0,
    ),
  );
  return centroids
    .map((centroid, index) => ({ centroid, count: counts[index] }))
    .filter(({ count }) => count > 0)
    .sort((first, second) => second.count - first.count)
    .map(({ centroid }) => hex(centroid));
}
