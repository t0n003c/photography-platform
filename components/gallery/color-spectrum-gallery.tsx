"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import {
  filterPhotosByColor,
  nextSupportedColorPosition,
  snapToSupportedColorPosition,
  supportedColorPositions,
  supportedColorPositionIntervals,
  isNeutralPhoto,
  type ColorSelection,
} from "@/src/lib/color-matching";
import {
  colorAtPosition,
  COLOR_SPECTRUM_PALETTE_LABELS,
  gradientForSpectrum,
  gradientForSpectrumSegment,
  gradientForSpectrumTransition,
  rgbToHex,
  type ColorSpectrumMatchAccuracy,
  type ColorSpectrumBarStyle,
  type ColorSpectrumNeutralMode,
  type ColorSpectrumPalette,
  type ColorSpectrumRange,
} from "@/src/lib/color-spectrum";
import { ResponsiveImage } from "./responsive-image";

interface ColorSpectrumGalleryProps {
  photos: PhotoDTO[];
  title?: string;
  subtitle?: string | null;
  onOpen: (index: number) => void;
  palette?: ColorSpectrumPalette;
  range?: ColorSpectrumRange;
  rangeStart?: number;
  rangeEnd?: number;
  matchAccuracy?: ColorSpectrumMatchAccuracy;
  snapToResults?: boolean;
  neutralMode?: ColorSpectrumNeutralMode;
  barStyle?: ColorSpectrumBarStyle;
}

function selectionLabel(selection: ColorSelection): string {
  if (selection.kind === "all") return "Showing all colors";
  if (selection.kind === "neutral") return "Showing neutral tones";
  return `Showing photos near position ${Math.round(selection.position)} on the spectrum`;
}

export function ColorSpectrumGallery({
  photos,
  title,
  subtitle,
  onOpen,
  palette = "full",
  range = "full",
  rangeStart = 0,
  rangeEnd = 1,
  matchAccuracy = "close",
  snapToResults = false,
  neutralMode = "spectrum",
  barStyle = "gradient",
}: ColorSpectrumGalleryProps) {
  const [selection, setSelection] = React.useState<ColorSelection>({ kind: "all" });
  const [hoveredBarSegment, setHoveredBarSegment] = React.useState<number | null>(null);
  const inputId = React.useId();
  const matchOptions = React.useMemo(
    () => ({ palette, range, rangeStart, rangeEnd, matchAccuracy, neutralMode }),
    [palette, range, rangeStart, rangeEnd, matchAccuracy, neutralMode],
  );
  const hasNeutralPhotos = React.useMemo(
    () => neutralMode === "button" && photos.some(isNeutralPhoto),
    [photos, neutralMode],
  );
  React.useEffect(() => {
    setSelection({ kind: "all" });
  }, [neutralMode]);
  const supportedPositions = React.useMemo(
    () => (snapToResults ? supportedColorPositions(photos, matchOptions) : []),
    [photos, matchOptions, snapToResults],
  );
  const selectedPosition = React.useMemo(
    () =>
      selection.kind === "position"
        ? snapToResults
          ? snapToSupportedColorPosition(selection.position, supportedPositions)
          : selection.position
        : 180,
    [selection, snapToResults, supportedPositions],
  );
  const resolvedSelection = React.useMemo<ColorSelection>(
    () =>
      selection.kind === "position"
        ? { kind: "position", position: selectedPosition }
        : selection,
    [selection, selectedPosition],
  );
  const supportedIntervals = React.useMemo(
    () => (snapToResults ? supportedColorPositionIntervals(supportedPositions) : []),
    [snapToResults, supportedPositions],
  );
  const supportedSpan = React.useMemo(
    () =>
      supportedIntervals.reduce(
        (total, interval) => total + Math.max(1, interval.end - interval.start),
        0,
      ),
    [supportedIntervals],
  );
  const compressedIntervals = React.useMemo(() => {
    if (supportedSpan === 0) return [];
    let offset = 0;
    return supportedIntervals.map((interval) => {
      const span = Math.max(1, interval.end - interval.start);
      const startProgress = offset / supportedSpan;
      offset += span;
      return {
        ...interval,
        span,
        startProgress,
        endProgress: offset / supportedSpan,
      };
    });
  }, [supportedIntervals, supportedSpan]);
  const rankedPhotos = React.useMemo(
    () => filterPhotosByColor(photos, resolvedSelection, matchOptions),
    [photos, resolvedSelection, matchOptions],
  );
  const sourceIndexById = React.useMemo(
    () => new Map(photos.map((photo, index) => [photo.id, index])),
    [photos],
  );
  // Keep the reset state visually distinct from the first tonal stop. This also
  // means clicking the far-left edge from the reset state selects the darkest
  // tonal position instead of leaving the gallery in "All colors" mode.
  const markerColor =
    resolvedSelection.kind === "position"
      ? rgbToHex(
          colorAtPosition(
            selectedPosition / 360,
            palette,
            range,
            rangeStart,
            rangeEnd,
            neutralMode,
          ),
        )
      : "#ffffff";

  const selectPosition = (rawPosition: number) => {
    setSelection({
      kind: "position",
      position: snapToResults
        ? snapToSupportedColorPosition(rawPosition, supportedPositions)
        : rawPosition,
    });
  };

  const compressedProgressForPosition = (position: number): number => {
    if (!snapToResults || compressedIntervals.length === 0) {
      return position / 360;
    }
    for (const interval of compressedIntervals) {
      if (position <= interval.end) {
        const localProgress =
          interval.end === interval.start
            ? 0.5
            : (Math.min(interval.end, Math.max(interval.start, position)) -
                interval.start) /
              (interval.end - interval.start);
        return (
          interval.startProgress +
          (interval.endProgress - interval.startProgress) * localProgress
        );
      }
    }
    return 1;
  };

  const positionForCompressedProgress = React.useCallback(
    (progress: number): number => {
      if (!snapToResults || compressedIntervals.length === 0) {
        return progress * 360;
      }
      const offset = Math.min(1, Math.max(0, progress));
      for (const interval of compressedIntervals) {
        if (offset <= interval.endProgress || interval === compressedIntervals.at(-1)) {
          const localProgress =
            interval.endProgress === interval.startProgress
              ? 0
              : Math.min(
                  1,
                  (offset - interval.startProgress) /
                    (interval.endProgress - interval.startProgress),
                );
          return interval.start + (interval.end - interval.start) * localProgress;
        }
      }
      return compressedIntervals.at(-1)?.end ?? 0;
    },
    [snapToResults, compressedIntervals],
  );

  const barSegments = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const startProgress = index / 12;
        const endProgress = (index + 1) / 12;
        const startPosition = positionForCompressedProgress(startProgress);
        const endPosition = positionForCompressedProgress(endProgress);
        const midpoint = (startPosition + endPosition) / 2;
        return {
          startProgress,
          endProgress,
          position: Math.round(midpoint),
          background: gradientForSpectrumSegment(
            startPosition,
            endPosition,
            palette,
            range,
            rangeStart,
            rangeEnd,
            neutralMode,
          ),
          color: rgbToHex(
            colorAtPosition(
              midpoint / 360,
              palette,
              range,
              rangeStart,
              rangeEnd,
              neutralMode,
            ),
          ),
          count: filterPhotosByColor(
            photos,
            { kind: "position", position: Math.round(midpoint) },
            matchOptions,
          ).length,
        };
      }),
    [
      photos,
      matchOptions,
      palette,
      range,
      rangeStart,
      rangeEnd,
      neutralMode,
      positionForCompressedProgress,
    ],
  );

  const barSegmentIndexForProgress = (progress: number): number =>
    Math.min(
      barSegments.length - 1,
      Math.max(0, Math.floor(Math.min(1, Math.max(0, progress)) * barSegments.length)),
    );

  const minimalLineBackground =
    snapToResults && compressedIntervals.length > 0
      ? "hsl(var(--muted))"
      : gradientForSpectrum(palette, range, rangeStart, rangeEnd, neutralMode);

  return (
    <section
      className="relative bg-background"
      data-color-spectrum-gallery
      aria-label={title ? undefined : "Color Spectrum gallery"}
      aria-labelledby={title ? `${inputId}-heading` : undefined}
    >
      <div className="mx-auto max-w-[1600px] px-4 pb-28 pt-10 sm:px-6 md:px-8 md:pt-14">
        {(title || subtitle) && (
          <header className="mb-8 max-w-2xl">
            {title && (
              <h2
                id={`${inputId}-heading`}
                className="text-3xl font-semibold tracking-tight md:text-5xl"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))] md:text-base">
                {subtitle}
              </p>
            )}
          </header>
        )}

        <p className="sr-only" aria-live="polite">
          {selectionLabel(resolvedSelection)}. {rankedPhotos.length} photos.
        </p>

        {rankedPhotos.length > 0 ? (
          <div
            key={`${selection.kind}-${selection.kind === "position" ? selection.position : ""}`}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          >
            {rankedPhotos.map((photo, index) => {
              const sourceIndex = sourceIndexById.get(photo.id);
              if (sourceIndex == null) return null;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpen(sourceIndex)}
                  className="color-spectrum-gallery__tile group relative aspect-[4/3] overflow-hidden rounded-sm bg-muted text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2"
                  style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
                  aria-label={`Open ${photo.altText || `photo ${index + 1}`}`}
                >
                  <ResponsiveImage
                    photo={photo}
                    sizes="(min-width:1280px) 16vw, (min-width:1024px) 20vw, (min-width:640px) 33vw, 50vw"
                    priority={index === 0}
                    className="block h-full w-full"
                    imgClassName="block h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-6 py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
            No close color matches. Try another point on the spectrum or choose All
            colors.
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur sm:px-6 md:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setSelection({ kind: "all" })}
              aria-pressed={selection.kind === "all"}
              className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] aria-pressed:bg-foreground aria-pressed:text-background"
            >
              All colors
            </button>
            {hasNeutralPhotos && (
              <button
                type="button"
                onClick={() => setSelection({ kind: "neutral" })}
                aria-pressed={selection.kind === "neutral"}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 aria-pressed:bg-foreground aria-pressed:text-background"
              >
                Neutral tones
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="sr-only">
              Choose a color on the spectrum
            </label>
            <div
              data-spectrum-bar-style={barStyle}
              className="relative flex h-9 overflow-hidden rounded-full border border-border/70"
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                setHoveredBarSegment(
                  barSegmentIndexForProgress(
                    (event.clientX - bounds.left) / bounds.width,
                  ),
                );
              }}
              onPointerLeave={() => setHoveredBarSegment(null)}
              onPointerDown={(event) => {
                if (!snapToResults || compressedIntervals.length === 0) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const progress = (event.clientX - bounds.left) / bounds.width;
                selectPosition(positionForCompressedProgress(progress));
              }}
            >
              {barStyle === "gradient" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex"
                  style={{
                    background:
                      snapToResults && compressedIntervals.length > 0
                        ? "hsl(var(--muted))"
                        : gradientForSpectrum(
                            palette,
                            range,
                            rangeStart,
                            rangeEnd,
                            neutralMode,
                          ),
                  }}
                >
                  {snapToResults && compressedIntervals.length > 0
                    ? compressedIntervals.map((interval) => (
                        <span
                          key={`${interval.start}-${interval.end}`}
                          className="block h-full shrink-0 transition-[width] duration-200"
                          style={{
                            width: `${(interval.endProgress - interval.startProgress) * 100}%`,
                            background: gradientForSpectrumSegment(
                              interval.start,
                              interval.end,
                              palette,
                              range,
                              rangeStart,
                              rangeEnd,
                              neutralMode,
                            ),
                          }}
                        />
                      ))
                    : null}
                  {snapToResults && compressedIntervals.length > 1
                    ? compressedIntervals.slice(0, -1).map((interval, index) => {
                        const nextInterval = compressedIntervals[index + 1];
                        return (
                          <span
                            key={`transition-${interval.end}-${nextInterval.start}`}
                            className="absolute inset-y-0 z-[2] -translate-x-1/2"
                            style={{
                              left: `${interval.endProgress * 100}%`,
                              width: "clamp(18px, 2vw, 32px)",
                              background: gradientForSpectrumTransition(
                                interval.end,
                                nextInterval.start,
                                palette,
                                range,
                                rangeStart,
                                rangeEnd,
                                neutralMode,
                              ),
                            }}
                          />
                        );
                      })
                    : null}
                </div>
              )}
              {barStyle === "minimal" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 flex h-1 -translate-y-1/2 overflow-hidden rounded-full"
                  style={{ background: minimalLineBackground }}
                >
                  {snapToResults && compressedIntervals.length > 0
                    ? compressedIntervals.map((interval) => (
                        <span
                          key={`${interval.start}-${interval.end}`}
                          className="block h-full shrink-0"
                          style={{
                            width: `${(interval.endProgress - interval.startProgress) * 100}%`,
                            background: gradientForSpectrumSegment(
                              interval.start,
                              interval.end,
                              palette,
                              range,
                              rangeStart,
                              rangeEnd,
                              neutralMode,
                            ),
                          }}
                        />
                      ))
                    : null}
                </div>
              )}
              {barStyle === "outline" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1 top-1/2 h-7 -translate-y-1/2 rounded-full border border-border/80 bg-background/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                >
                  <div className="absolute inset-x-2 top-1/2 flex h-1 -translate-y-1/2 overflow-hidden rounded-full">
                    {snapToResults && compressedIntervals.length > 0 ? (
                      compressedIntervals.map((interval) => (
                        <span
                          key={`${interval.start}-${interval.end}`}
                          className="block h-full shrink-0"
                          style={{
                            width: `${(interval.endProgress - interval.startProgress) * 100}%`,
                            background: gradientForSpectrumSegment(
                              interval.start,
                              interval.end,
                              palette,
                              range,
                              rangeStart,
                              rangeEnd,
                              neutralMode,
                            ),
                          }}
                        />
                      ))
                    ) : (
                      <span
                        className="block h-full w-full"
                        style={{
                          background: gradientForSpectrum(
                            palette,
                            range,
                            rangeStart,
                            rangeEnd,
                            neutralMode,
                          ),
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
              {barStyle === "dots" && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-2 top-1/2 flex h-7 -translate-y-1/2 items-center justify-between"
                >
                  {barSegments.map((segment, index) => (
                    <span
                      key={index}
                      className="block h-5 w-5 shrink-0 rounded-full border border-white/35 shadow-[0_1px_4px_rgba(0,0,0,0.25)]"
                      style={{ background: segment.color }}
                    />
                  ))}
                </div>
              )}
              {(barStyle === "segments" || barStyle === "chips") && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute inset-x-1 top-1/2 flex -translate-y-1/2 ${
                    barStyle === "chips"
                      ? "h-6 gap-1"
                      : "inset-y-0 top-0 -translate-y-0"
                  }`}
                >
                  {barSegments.map((segment, index) => (
                    <span
                      key={index}
                      className={`block min-w-0 flex-1 ${
                        barStyle === "chips"
                          ? "rounded-md"
                          : "border-r border-white/25 last:border-r-0"
                      }`}
                      style={{
                        flexGrow: segment.endProgress - segment.startProgress,
                        background:
                          barStyle === "chips" ? segment.color : segment.background,
                      }}
                    />
                  ))}
                </div>
              )}
              <input
                id={inputId}
                type="range"
                min="0"
                max="360"
                step="1"
                value={selectedPosition}
                onChange={(event) => selectPosition(Number(event.target.value))}
                onKeyDown={(event) => {
                  if (!snapToResults || supportedPositions.length === 0) return;
                  const current = selectedPosition;
                  if (event.key === "Home") {
                    event.preventDefault();
                    selectPosition(supportedPositions[0]);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    selectPosition(supportedPositions[supportedPositions.length - 1]);
                  } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                    event.preventDefault();
                    selectPosition(
                      nextSupportedColorPosition(
                        current,
                        "forward",
                        supportedPositions,
                      ),
                    );
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                    event.preventDefault();
                    selectPosition(
                      nextSupportedColorPosition(
                        current,
                        "backward",
                        supportedPositions,
                      ),
                    );
                  }
                }}
                aria-label="Choose a color on the spectrum"
                aria-valuetext={
                  selection.kind === "position"
                    ? `${Math.round(selectedPosition)} on the ${COLOR_SPECTRUM_PALETTE_LABELS[palette].toLowerCase()}, ${rankedPhotos.length} photo results`
                    : "Choose a color on the spectrum"
                }
                onFocus={() =>
                  setHoveredBarSegment(
                    barSegmentIndexForProgress(
                      compressedProgressForPosition(selectedPosition),
                    ),
                  )
                }
                onBlur={() => setHoveredBarSegment(null)}
                className={`absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 ${snapToResults ? "pointer-events-none" : ""}`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_5px_rgba(0,0,0,0.45)] transition-[left] duration-150 ${barStyle === "minimal" ? "h-8 w-8" : "h-7 w-7"}`}
                style={{
                  left: `${compressedProgressForPosition(selectedPosition) * 100}%`,
                  backgroundColor: markerColor,
                  opacity: selection.kind === "neutral" ? 0 : 1,
                }}
              />
            </div>
            {hoveredBarSegment !== null && barSegments[hoveredBarSegment] && (
              <p className="mt-1 text-center text-[11px] text-[hsl(var(--muted-foreground))]">
                {barSegments[hoveredBarSegment].count === 0
                  ? "No close photo matches"
                  : `${barSegments[hoveredBarSegment].count} ${barSegments[hoveredBarSegment].count === 1 ? "photo" : "photos"} near this color`}
              </p>
            )}
          </div>

          <span className="min-w-32 text-right text-xs text-[hsl(var(--muted-foreground))]">
            {selection.kind === "all"
              ? "All colors"
              : selection.kind === "neutral"
                ? "Neutral tones"
                : snapToResults
                  ? `${Math.round(selectedPosition)} · photo results`
                  : `${Math.round(selectedPosition)} position`}
          </span>
        </div>
      </div>
    </section>
  );
}
