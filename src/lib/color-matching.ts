import {
  colorAtPosition,
  isNeutralRgb,
  parseHexColor,
  type ColorSpectrumMatchAccuracy,
  type ColorSpectrumNeutralMode,
  type ColorSpectrumPalette,
  type ColorSpectrumRange,
  type RGB,
} from "./color-spectrum";

export type ColorSelection =
  | { kind: "all" }
  | { kind: "neutral" }
  | { kind: "position"; position: number };

export interface DominantColorPhoto {
  dominantColor: string | null;
  colorPalette?: readonly string[] | null;
}

type OKLab = readonly [number, number, number];

export const COLOR_MATCH_DISTANCES: Record<ColorSpectrumMatchAccuracy, number> = {
  "very-close": 0.12,
  close: 0.18,
  balanced: 0.24,
  broad: 0.32,
};

export interface ColorMatchOptions {
  palette?: ColorSpectrumPalette;
  range?: ColorSpectrumRange;
  rangeStart?: number;
  rangeEnd?: number;
  matchAccuracy?: ColorSpectrumMatchAccuracy;
  neutralMode?: ColorSpectrumNeutralMode;
}

const SPECTRUM_POSITION_COUNT = 361;

export interface ColorPositionInterval {
  start: number;
  end: number;
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToOklab([red, green, blue]: RGB): OKLab {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
}

function colorDistance(
  first: readonly [number, number, number],
  second: readonly [number, number, number],
): number {
  const firstLab = rgbToOklab(first);
  const secondLab = rgbToOklab(second);
  return Math.hypot(
    firstLab[0] - secondLab[0],
    firstLab[1] - secondLab[1],
    firstLab[2] - secondLab[2],
  );
}

function photoColors(photo: DominantColorPhoto): RGB[] {
  const palette = (photo.colorPalette ?? [])
    .map(parseHexColor)
    .filter((color): color is RGB => Boolean(color));
  if (palette.length > 0) return palette;
  return [parseHexColor(photo.dominantColor) ?? [0.5, 0.5, 0.5]];
}

function bestPhotoColorDistance(photo: DominantColorPhoto, target: RGB): number {
  return Math.min(...photoColors(photo).map((color) => colorDistance(color, target)));
}

/** Find the closest one-degree spectrum position for a photo's fallback bucket. */
export function nearestColorPosition(
  photo: DominantColorPhoto,
  options: ColorMatchOptions = {},
): number {
  let nearestPosition = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let position = 0; position < SPECTRUM_POSITION_COUNT; position += 1) {
    const target = colorAtPosition(
      position / 360,
      options.palette,
      options.range,
      options.rangeStart,
      options.rangeEnd,
      options.neutralMode,
    );
    const distance = bestPhotoColorDistance(photo, target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPosition = position;
    }
  }
  return nearestPosition;
}

export function isNeutralPhoto(photo: DominantColorPhoto): boolean {
  return photoColors(photo).every(isNeutralRgb);
}

function chromaticPhotos<T extends DominantColorPhoto>(
  photos: readonly T[],
  options: ColorMatchOptions,
): T[] {
  return options.neutralMode === "button"
    ? photos.filter((photo) => !isNeutralPhoto(photo))
    : [...photos];
}

/** Return the one-degree spectrum positions that have at least one match. */
export function supportedColorPositions<T extends DominantColorPhoto>(
  photos: readonly T[],
  options: ColorMatchOptions = {},
): number[] {
  if (photos.length === 0) return [];
  const availablePhotos = chromaticPhotos(photos, options);
  const fallbackPositions = new Set(
    availablePhotos.map((photo) => nearestColorPosition(photo, options)),
  );
  const maxDistance = COLOR_MATCH_DISTANCES[options.matchAccuracy ?? "close"];
  return Array.from(
    { length: SPECTRUM_POSITION_COUNT },
    (_, position) => position,
  ).filter(
    (position) =>
      fallbackPositions.has(position) ||
      availablePhotos.some((photo) => {
        const target = colorAtPosition(
          position / 360,
          options.palette,
          options.range,
          options.rangeStart,
          options.rangeEnd,
          options.neutralMode,
        );
        return bestPhotoColorDistance(photo, target) <= maxDistance;
      }),
  );
}

/** Snap a free-form slider position to the nearest supported position. */
export function snapToSupportedColorPosition(
  position: number,
  supportedPositions: readonly number[],
): number {
  const rounded = Math.round(Math.min(360, Math.max(0, position)));
  if (supportedPositions.length === 0) return rounded;
  return supportedPositions.reduce((nearest, candidate) =>
    Math.abs(candidate - rounded) < Math.abs(nearest - rounded) ? candidate : nearest,
  );
}

export function nextSupportedColorPosition(
  position: number,
  direction: "forward" | "backward",
  supportedPositions: readonly number[],
): number {
  if (supportedPositions.length === 0) return Math.round(position);
  if (direction === "forward") {
    return supportedPositions.find((candidate) => candidate > position) ?? position;
  }
  return (
    [...supportedPositions].reverse().find((candidate) => candidate < position) ??
    position
  );
}

/** Return inclusive one-degree runs that have at least one matching photo. */
export function supportedColorPositionIntervals(
  supportedPositions: readonly number[],
): ColorPositionInterval[] {
  const supported = new Set(supportedPositions);
  const intervals: ColorPositionInterval[] = [];
  let intervalStart: number | null = null;

  for (let position = 0; position < SPECTRUM_POSITION_COUNT; position += 1) {
    if (supported.has(position)) {
      intervalStart ??= position;
    } else if (intervalStart !== null) {
      intervals.push({ start: intervalStart, end: position - 1 });
      intervalStart = null;
    }
  }
  if (intervalStart !== null) intervals.push({ start: intervalStart, end: 360 });
  return intervals;
}

export function sortPhotosByColor<T extends DominantColorPhoto>(
  photos: readonly T[],
  selection: ColorSelection,
  options: ColorMatchOptions = {},
): T[] {
  if (selection.kind === "all") return [...photos];
  if (selection.kind === "neutral") return photos.filter(isNeutralPhoto);

  const availablePhotos = chromaticPhotos(photos, options);

  const target = colorAtPosition(
    selection.position / 360,
    options.palette,
    options.range,
    options.rangeStart,
    options.rangeEnd,
    options.neutralMode,
  );
  return availablePhotos
    .map((photo, index) => ({
      photo,
      index,
      score: bestPhotoColorDistance(photo, target),
    }))
    .sort((first, second) => first.score - second.score || first.index - second.index)
    .map(({ photo }) => photo);
}

export function filterPhotosByColor<T extends DominantColorPhoto>(
  photos: readonly T[],
  selection: ColorSelection,
  options: ColorMatchOptions = {},
): T[] {
  if (selection.kind === "all") return [...photos];
  if (selection.kind === "neutral") return photos.filter(isNeutralPhoto);

  const availablePhotos = chromaticPhotos(photos, options);

  const target = colorAtPosition(
    selection.position / 360,
    options.palette,
    options.range,
    options.rangeStart,
    options.rangeEnd,
    options.neutralMode,
  );
  const maxDistance = COLOR_MATCH_DISTANCES[options.matchAccuracy ?? "close"];
  const fallbackPositions = availablePhotos.map((photo) =>
    nearestColorPosition(photo, options),
  );
  const roundedSelectionPosition = Math.round(
    Math.min(360, Math.max(0, selection.position)),
  );
  return availablePhotos
    .map((photo, index) => ({
      photo,
      index,
      score: bestPhotoColorDistance(photo, target),
    }))
    .map((entry) => ({
      ...entry,
      isFallback: fallbackPositions[entry.index] === roundedSelectionPosition,
    }))
    .filter(({ score, isFallback }) => score <= maxDistance || isFallback)
    .sort(
      (first, second) =>
        Number(first.score > maxDistance) - Number(second.score > maxDistance) ||
        first.score - second.score ||
        first.index - second.index,
    )
    .map(({ photo }) => photo);
}
