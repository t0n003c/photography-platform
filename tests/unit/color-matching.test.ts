import { describe, expect, it } from "vitest";
import {
  filterPhotosByColor,
  isNeutralPhoto,
  nearestColorPosition,
  nextSupportedColorPosition,
  snapToSupportedColorPosition,
  sortPhotosByColor,
  supportedColorPositions,
  supportedColorPositionIntervals,
} from "@/src/lib/color-matching";

const photo = (id: string, dominantColor: string | null, colorPalette?: string[]) => ({
  id,
  dominantColor,
  colorPalette,
});

describe("color spectrum matching", () => {
  it("preserves source order when all colors are selected", () => {
    const photos = [photo("blue", "#315ee8"), photo("red", "#e83f31")];

    expect(sortPhotosByColor(photos, { kind: "all" }).map((item) => item.id)).toEqual([
      "blue",
      "red",
    ]);
  });

  it("ranks photos by perceptual distance from the selected hue", () => {
    const photos = [
      photo("blue", "#315ee8"),
      photo("red", "#e83f31"),
      photo("orange", "#e87b31"),
    ];

    expect(
      sortPhotosByColor(photos, { kind: "position", position: 108 }).map(
        (item) => item.id,
      ),
    ).toEqual(["red", "orange", "blue"]);
  });

  it("keeps photos with missing color metadata usable", () => {
    const photos = [photo("missing", null), photo("red", "#e83f31")];

    expect(sortPhotosByColor(photos, { kind: "position", position: 108 })[0].id).toBe(
      "red",
    );
  });

  it("matches against representative palette colors instead of only the average", () => {
    const photos = [
      photo("colorful", "#777777", ["#777777", "#e11d48"]),
      photo("gray", "#777777"),
    ];

    expect(
      filterPhotosByColor(
        photos,
        { kind: "position", position: 108 },
        { matchAccuracy: "close" },
      ).map((item) => item.id),
    ).toContain("colorful");
  });

  it("removes distant hue matches instead of showing them at the end", () => {
    const photos = [photo("red", "#e83f31"), photo("blue", "#315ee8")];

    expect(
      filterPhotosByColor(photos, { kind: "position", position: 108 }).map(
        (item) => item.id,
      ),
    ).toEqual(["red"]);
  });

  it("gives every photo a nearest fallback position without mixing distant colors", () => {
    const photos = [
      photo("red", "#e83f31"),
      photo("blue", "#315ee8"),
      photo("muted", "#e8e8e8", ["#e9eaea", "#544b3e", "#2c2721"]),
    ];
    const options = { matchAccuracy: "very-close" as const };
    const mutedPosition = nearestColorPosition(photos[2], options);

    expect(
      filterPhotosByColor(
        photos,
        { kind: "position", position: mutedPosition },
        options,
      ).map((item) => item.id),
    ).toContain("muted");
    expect(
      filterPhotosByColor(photos, { kind: "position", position: 108 }, options).map(
        (item) => item.id,
      ),
    ).not.toContain("blue");
  });

  it("supports tighter matching and alternate spectrum palettes", () => {
    const photos = [
      photo("deep-red", "#7f1d1d"),
      photo("orange", "#f97316"),
      photo("blue", "#2563eb"),
    ];

    expect(
      filterPhotosByColor(
        photos,
        { kind: "position", position: 154 },
        { palette: "warm", matchAccuracy: "very-close" },
      ).map((item) => item.id),
    ).toEqual(["deep-red"]);
  });

  it("maps a selected range onto the visible spectrum", () => {
    const photos = [photo("green", "#22c55e"), photo("blue", "#3b82f6")];

    expect(
      filterPhotosByColor(
        photos,
        { kind: "position", position: 0 },
        {
          range: "custom",
          rangeStart: 0.6,
          rangeEnd: 0.7,
          matchAccuracy: "very-close",
        },
      ).map((item) => item.id),
    ).toEqual(["green"]);
  });

  it("keeps tonal and chromatic photos in the same spectrum", () => {
    const photos = [
      photo("black", "#181818"),
      photo("gray", "#7a7a7a"),
      photo("white", "#f8f8f8"),
      photo("red", "#ef4444"),
    ];

    expect(filterPhotosByColor(photos, { kind: "position", position: 0 })).toEqual([
      photos[0],
    ]);
    expect(filterPhotosByColor(photos, { kind: "position", position: 36 })).toEqual([
      photos[1],
    ]);
    expect(filterPhotosByColor(photos, { kind: "position", position: 72 })).toEqual([
      photos[2],
    ]);
    expect(filterPhotosByColor(photos, { kind: "position", position: 108 })).toEqual([
      photos[3],
    ]);
  });

  it("can move consistently neutral photos to a separate selection", () => {
    const photos = [
      photo("gray", "#777777", ["#181818", "#f8f8f8"]),
      photo("accented", "#777777", ["#777777", "#ef4444"]),
      photo("red", "#ef4444"),
    ];

    expect(isNeutralPhoto(photos[0])).toBe(true);
    expect(isNeutralPhoto(photos[1])).toBe(false);
    expect(
      filterPhotosByColor(photos, { kind: "neutral" }, { neutralMode: "button" }).map(
        (item) => item.id,
      ),
    ).toEqual(["gray"]);
    expect(
      filterPhotosByColor(
        photos,
        { kind: "position", position: 0 },
        { neutralMode: "button" },
      ).map((item) => item.id),
    ).toContain("accented");
  });

  it("finds and snaps to positions that have matching photos", () => {
    const photos = [photo("red", "#ef4444"), photo("blue", "#3b82f6")];
    const supported = supportedColorPositions(photos, { matchAccuracy: "very-close" });

    expect(supported.length).toBeGreaterThan(0);
    expect(snapToSupportedColorPosition(supported[0] - 10, supported)).toBe(
      supported[0],
    );
    expect(
      nextSupportedColorPosition(supported[0], "forward", supported),
    ).toBeGreaterThan(supported[0]);
    expect(
      nextSupportedColorPosition(
        supported[supported.length - 1],
        "backward",
        supported,
      ),
    ).toBeLessThan(supported[supported.length - 1]);
  });

  it("returns contiguous spectrum runs for the compressed bar", () => {
    expect(supportedColorPositionIntervals([0, 1, 4, 5, 360])).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
      { start: 360, end: 360 },
    ]);
  });
});
