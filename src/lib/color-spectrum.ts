export type ColorSpectrumPalette =
  | "full"
  | "warm"
  | "cool"
  | "earth"
  | "pastel"
  | "monochrome";

export type ColorSpectrumRange =
  | "full"
  | "warm"
  | "nature"
  | "cool"
  | "violet"
  | "custom";

export type ColorSpectrumNeutralMode = "spectrum" | "button";

export type ColorSpectrumBarStyle =
  | "gradient"
  | "segments"
  | "minimal"
  | "chips"
  | "dots"
  | "outline";

export interface ColorSpectrumRangeBounds {
  start: number;
  end: number;
}

export type RGB = readonly [number, number, number];

// Every palette begins with the same tonal ramp so grayscale and muted photos
// can either remain discoverable through the bar or move to a separate control.
const UNIFIED_TONAL_STOPS = ["#181818", "#7a7a7a", "#f8f8f8"] as const;

export const COLOR_SPECTRUM_PALETTES: Record<ColorSpectrumPalette, readonly string[]> =
  {
    full: [
      ...UNIFIED_TONAL_STOPS,
      "#ef4444",
      "#f97316",
      "#eab308",
      "#22c55e",
      "#06b6d4",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
    ],
    warm: [
      ...UNIFIED_TONAL_STOPS,
      "#7f1d1d",
      "#dc2626",
      "#f97316",
      "#f59e0b",
      "#fde68a",
    ],
    cool: [
      ...UNIFIED_TONAL_STOPS,
      "#042f2e",
      "#0f766e",
      "#06b6d4",
      "#3b82f6",
      "#4338ca",
      "#7c3aed",
    ],
    earth: [
      ...UNIFIED_TONAL_STOPS,
      "#f3eadb",
      "#d8c98d",
      "#b98546",
      "#8b5e34",
      "#556b2f",
      "#334155",
    ],
    pastel: [
      ...UNIFIED_TONAL_STOPS,
      "#f9a8d4",
      "#fdba74",
      "#fde68a",
      "#86efac",
      "#7dd3fc",
      "#c4b5fd",
    ],
    monochrome: ["#18181b", "#52525b", "#a1a1aa", "#e4e4e7", "#fafafa"],
  };

export const COLOR_SPECTRUM_RANGE_PRESETS: Record<
  Exclude<ColorSpectrumRange, "custom">,
  { label: string; start: number; end: number }
> = {
  full: { label: "Full range", start: 0, end: 1 },
  warm: { label: "Warm range", start: 0, end: 0.34 },
  nature: { label: "Nature range", start: 0.27, end: 0.56 },
  cool: { label: "Cool range", start: 0.48, end: 0.82 },
  violet: { label: "Violet range", start: 0.76, end: 1 },
};

export const COLOR_SPECTRUM_PALETTE_LABELS: Record<ColorSpectrumPalette, string> = {
  full: "Full spectrum",
  warm: "Warm colors",
  cool: "Cool colors",
  earth: "Earth tones",
  pastel: "Pastels",
  monochrome: "Monochrome",
};

export const COLOR_SPECTRUM_NEUTRAL_MODE_LABELS: Record<
  ColorSpectrumNeutralMode,
  string
> = {
  spectrum: "Part of spectrum",
  button: "Separate button",
};

export const COLOR_SPECTRUM_BAR_STYLE_LABELS: Record<ColorSpectrumBarStyle, string> = {
  gradient: "Smooth gradient",
  segments: "Segmented swatches",
  minimal: "Minimal line",
  chips: "Color chips",
  dots: "Color dots",
  outline: "Outlined spectrum",
};

export const COLOR_SPECTRUM_MATCH_LABELS = {
  "very-close": "Very close",
  close: "Close",
  balanced: "Balanced",
  broad: "Broad",
} as const;

export type ColorSpectrumMatchAccuracy = keyof typeof COLOR_SPECTRUM_MATCH_LABELS;

export function parseHexColor(value: string | null | undefined): RGB | null {
  if (!value) return null;
  const hex = value.trim().replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => part + part)
          .join("")
      : hex;
  return [
    Number.parseInt(expanded.slice(0, 2), 16) / 255,
    Number.parseInt(expanded.slice(2, 4), 16) / 255,
    Number.parseInt(expanded.slice(4, 6), 16) / 255,
  ];
}

export function isNeutralRgb([red, green, blue]: RGB): boolean {
  return Math.max(red, green, blue) - Math.min(red, green, blue) <= 0.08;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function boundsForRange(
  range: ColorSpectrumRange,
  start: number,
  end: number,
): ColorSpectrumRangeBounds {
  if (range !== "custom") return COLOR_SPECTRUM_RANGE_PRESETS[range];
  const safeStart = clamp(Math.min(start, end), 0, 1);
  const safeEnd = clamp(Math.max(start, end), 0, 1);
  return { start: safeStart, end: safeEnd };
}

function spectrumColors(
  palette: ColorSpectrumPalette,
  neutralMode: ColorSpectrumNeutralMode,
): RGB[] {
  const colors = COLOR_SPECTRUM_PALETTES[palette]
    .map(parseHexColor)
    .filter((color): color is RGB => Boolean(color));
  if (neutralMode !== "button") return colors;
  return colors.filter((color) => !isNeutralRgb(color));
}

export function colorAtPosition(
  position: number,
  palette: ColorSpectrumPalette = "full",
  range: ColorSpectrumRange = "full",
  rangeStart = 0,
  rangeEnd = 1,
  neutralMode: ColorSpectrumNeutralMode = "spectrum",
): RGB {
  const colors = spectrumColors(palette, neutralMode);
  if (colors.length === 0) return [0.5, 0.5, 0.5];

  const bounds = boundsForRange(range, rangeStart, rangeEnd);
  const absolutePosition =
    bounds.start + clamp(position, 0, 1) * (bounds.end - bounds.start);
  const scaled = absolutePosition * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const amount = index < 0 ? 0 : scaled - index;
  const first = colors[Math.max(0, index)];
  const second = colors[Math.max(0, index + 1)] ?? first;
  return [
    first[0] + (second[0] - first[0]) * amount,
    first[1] + (second[1] - first[1]) * amount,
    first[2] + (second[2] - first[2]) * amount,
  ];
}

export function rgbToHex([red, green, blue]: RGB): string {
  return `#${[red, green, blue]
    .map((value) =>
      Math.round(clamp(value, 0, 1) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function gradientForSpectrum(
  palette: ColorSpectrumPalette = "full",
  range: ColorSpectrumRange = "full",
  rangeStart = 0,
  rangeEnd = 1,
  neutralMode: ColorSpectrumNeutralMode = "spectrum",
): string {
  const stops = Array.from({ length: 17 }, (_, index) =>
    rgbToHex(
      colorAtPosition(index / 16, palette, range, rangeStart, rangeEnd, neutralMode),
    ),
  );
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function gradientForSpectrumSegment(
  startPosition: number,
  endPosition: number,
  palette: ColorSpectrumPalette = "full",
  range: ColorSpectrumRange = "full",
  rangeStart = 0,
  rangeEnd = 1,
  neutralMode: ColorSpectrumNeutralMode = "spectrum",
): string {
  const span = Math.max(1, endPosition - startPosition);
  const stopCount = Math.max(3, Math.min(17, Math.ceil(span / 22) + 1));
  const stops = Array.from({ length: stopCount }, (_, index) => {
    const amount = index / (stopCount - 1);
    return rgbToHex(
      colorAtPosition(
        (startPosition + span * amount) / 360,
        palette,
        range,
        rangeStart,
        rangeEnd,
        neutralMode,
      ),
    );
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function gradientForSpectrumTransition(
  fromPosition: number,
  toPosition: number,
  palette: ColorSpectrumPalette = "full",
  range: ColorSpectrumRange = "full",
  rangeStart = 0,
  rangeEnd = 1,
  neutralMode: ColorSpectrumNeutralMode = "spectrum",
): string {
  const stops = [0, 0.18, 0.5, 0.82, 1].map((amount) => {
    const easedAmount = amount * amount * (3 - 2 * amount);
    const color = colorAtPosition(
      (fromPosition + (toPosition - fromPosition) * easedAmount) / 360,
      palette,
      range,
      rangeStart,
      rangeEnd,
      neutralMode,
    );
    return `${rgbToHex(color)} ${Math.round(amount * 100)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
