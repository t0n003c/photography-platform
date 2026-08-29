"use client";

import * as React from "react";
import type { PhotoDTO } from "@/src/db/queries/photos";
import { ResponsiveImage } from "./responsive-image";

export type MoodboardTheme = "paper" | "clean" | "dark";
export type MoodboardDensity = "spacious" | "balanced" | "layered";
export type MoodboardFrames = "matte" | "border" | "none";

export interface MoodboardGalleryProps {
  photos: PhotoDTO[];
  title?: string | null;
  subtitle?: string | null;
  eyebrow?: string | null;
  noteLeft?: string | null;
  noteRight?: string | null;
  noteBottom?: string | null;
  theme?: MoodboardTheme;
  density?: MoodboardDensity;
  frames?: MoodboardFrames;
  paperTexture?: boolean;
  rotations?: boolean;
  tornEdges?: boolean;
  pins?: boolean;
  showCaptions?: boolean;
  onOpen: (index: number) => void;
}

interface PhotoPosition {
  desktop: string;
  aspectClass: string;
  rotation: number;
}

const PHOTO_POSITIONS: PhotoPosition[] = [
  {
    desktop: "md:left-[12%] md:top-[4%] md:w-[38%]",
    aspectClass: "aspect-[4/5]",
    rotation: -0.8,
  },
  {
    desktop: "md:left-[45%] md:top-[9%] md:w-[30%]",
    aspectClass: "aspect-[4/3]",
    rotation: 1.1,
  },
  {
    desktop: "md:left-[38%] md:top-[42%] md:w-[30%]",
    aspectClass: "aspect-[4/5]",
    rotation: -0.6,
  },
  {
    desktop: "md:left-[64%] md:top-[35%] md:w-[27%]",
    aspectClass: "aspect-[3/4]",
    rotation: 0.8,
  },
  {
    desktop: "md:left-[13%] md:top-[59%] md:w-[29%]",
    aspectClass: "aspect-[4/3]",
    rotation: 0.5,
  },
  {
    desktop: "md:left-[50%] md:top-[63%] md:w-[32%]",
    aspectClass: "aspect-[3/2]",
    rotation: -0.8,
  },
  {
    desktop: "md:left-[4%] md:top-[45%] md:w-[15%]",
    aspectClass: "aspect-[4/3]",
    rotation: -2,
  },
];

const PAPER_COLORS = ["#151515", "#514e48", "#a8a6a3", "#6d3d22", "#a5744a", "#36483b"];

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function captionFor(photo: PhotoDTO, index: number): string {
  return cleanText(photo.headline) ?? cleanText(photo.altText) ?? `Photo ${index + 1}`;
}

function themeClasses(theme: MoodboardTheme) {
  if (theme === "dark") {
    return {
      surface: "bg-[#1b1a18] text-[#f4efe7]",
      muted: "text-[#c3bbb0]",
      rule: "border-[#e8ded0]/45",
      paperCard: "bg-[#292724]",
      frame: "bg-[#f4efe7]",
      frameText: "text-[#191817]",
    };
  }
  if (theme === "clean") {
    return {
      surface: "bg-[#f8f8f6] text-[#181818]",
      muted: "text-[#6a6a67]",
      rule: "border-[#181818]/35",
      paperCard: "bg-[#ffffff]",
      frame: "bg-[#ffffff]",
      frameText: "text-[#181818]",
    };
  }
  return {
    surface: "bg-[#f8f8f5] text-[#171717]",
    muted: "text-[#6a6861]",
    rule: "border-[#171717]/45",
    paperCard: "bg-[#f1f1ec]",
    frame: "bg-[#fffdf8]",
    frameText: "text-[#171717]",
  };
}

function frameClasses(frames: MoodboardFrames, theme: MoodboardTheme): string {
  if (frames === "none") return "bg-transparent";
  if (frames === "border") {
    return theme === "dark"
      ? "border border-[#f4efe7]/45 bg-transparent p-1"
      : "border border-black/20 bg-transparent p-1";
  }
  return "bg-white p-2 shadow-[0_12px_28px_rgba(34,28,20,0.16)] md:p-3";
}

function tornClip(index: number): string {
  const clips = [
    "polygon(1% 0, 99% 1%, 100% 98%, 97% 100%, 91% 99%, 84% 100%, 77% 98%, 67% 100%, 58% 98%, 49% 100%, 38% 98%, 30% 100%, 20% 98%, 11% 100%, 0 97%)",
    "polygon(0 2%, 98% 0, 100% 8%, 99% 19%, 100% 31%, 98% 42%, 100% 53%, 98% 66%, 100% 78%, 98% 90%, 99% 100%, 2% 98%, 0 88%, 1% 76%, 0 63%, 1% 50%, 0 37%, 1% 24%)",
  ];
  return clips[index % clips.length];
}

function photoColors(photos: PhotoDTO[]): string[] {
  const colors = photos
    .map((photo) => photo.dominantColor)
    .filter((color): color is string => Boolean(color));
  return Array.from(new Set(colors)).slice(0, 6).concat(PAPER_COLORS).slice(0, 6);
}

export function MoodboardGallery({
  photos,
  title,
  subtitle,
  eyebrow = "Visual collection",
  noteLeft,
  noteRight,
  noteBottom,
  theme = "paper",
  density = "balanced",
  frames = "matte",
  paperTexture = true,
  rotations = true,
  tornEdges = true,
  pins = true,
  showCaptions = true,
  onOpen,
}: MoodboardGalleryProps) {
  const colors = React.useMemo(() => photoColors(photos), [photos]);
  const visibleCount = density === "spacious" ? 5 : density === "layered" ? 7 : 6;
  const visiblePhotos = photos.slice(0, visibleCount);
  const classes = themeClasses(theme);
  const resolvedTitle = cleanText(title) ?? "Mood board";

  return (
    <section
      data-moodboard-gallery
      className={`relative overflow-hidden ${classes.surface}`}
      aria-label={resolvedTitle}
    >
      {paperTexture && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70 mix-blend-multiply"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 12% 18%, rgba(255, 255, 255, 0.76) 0 5%, transparent 32%), radial-gradient(ellipse at 85% 72%, rgba(190, 188, 180, 0.12) 0 2%, transparent 34%), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.035 .16' numOctaves='3' seed='8' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)' opacity='.2'/%3E%3C/svg%3E\")",
            backgroundSize: "auto, auto, 240px 240px",
          }}
        />
      )}
      <div className="relative mx-auto max-w-[1220px] px-5 py-8 sm:px-8 md:px-12 md:py-10">
        <header className="relative z-30">
          <div className={`flex items-center gap-4 border-b pb-2 ${classes.rule}`}>
            <p className="font-josefin text-[10px] font-medium uppercase tracking-[0.18em] sm:text-xs">
              {cleanText(eyebrow) ?? "Visual collection"}
            </p>
            <span className={`h-px flex-1 border-t ${classes.rule}`} />
          </div>
          <div className="py-5 text-center md:py-6">
            <h2 className="font-cormorant mx-auto max-w-[760px] text-4xl font-semibold uppercase leading-[0.96] tracking-[0.2em] sm:text-5xl md:text-6xl">
              {resolvedTitle}
            </h2>
            {cleanText(subtitle) && (
              <p
                className={`mx-auto mt-3 max-w-[440px] text-sm ${classes.muted} md:text-base`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </header>

        <div className="relative z-30 mb-5 flex items-center justify-center gap-1 md:absolute md:right-[140px] md:top-[292px] md:mb-0 md:flex-col md:gap-0">
          {colors.map((color, index) => (
            <span
              key={`${color}-${index}`}
              aria-label={`Palette color ${index + 1}`}
              role="img"
              className="h-5 w-10 border border-black/10 md:h-11 md:w-14"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="relative mx-auto min-h-0 max-w-[1060px] md:min-h-[820px] md:pr-[40px]">
          {cleanText(noteLeft) && (
            <div className="absolute left-0 top-[38%] z-30 hidden max-w-[115px] -rotate-6 md:block">
              <p className="font-caveat text-[26px] leading-[0.9]">{noteLeft}</p>
              <span
                aria-hidden="true"
                className="font-caveat ml-10 text-3xl leading-none"
              >
                ↗
              </span>
            </div>
          )}
          {cleanText(noteRight) && (
            <p
              className={`font-cormorant absolute right-0 top-[56%] z-30 hidden w-[175px] rotate-1 border-l-2 px-4 py-5 text-base font-semibold leading-tight md:block ${classes.paperCard}`}
              style={{
                clipPath: tornEdges ? tornClip(visiblePhotos.length + 1) : undefined,
              }}
            >
              {noteRight}
            </p>
          )}

          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:block">
            {visiblePhotos.map((photo, index) => {
              const position = PHOTO_POSITIONS[index % PHOTO_POSITIONS.length];
              const rotation = rotations ? position.rotation : 0;
              const useTornEdge = tornEdges && (index === 0 || index === 4);
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onOpen(index)}
                  aria-label={`Open ${captionFor(photo, index)}`}
                  className={`group relative block w-full text-left transition-[z-index,box-shadow] duration-300 hover:z-40 hover:shadow-[0_18px_38px_rgba(34,28,20,0.22)] focus:outline-none focus-visible:z-40 focus-visible:ring-2 focus-visible:ring-current md:absolute ${position.desktop}`}
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  {index === 0 && frames !== "none" && (
                    <span
                      aria-hidden="true"
                      className="absolute left-[22%] top-[-11px] z-20 h-7 w-7 rounded-full border border-[#c8c0ae]/45 bg-[#f2e9e5]/80 shadow-[0_2px_4px_rgba(60,50,40,0.16)] backdrop-blur-[1px]"
                    />
                  )}
                  <div
                    className={`${frameClasses(frames, theme)} ${useTornEdge ? "overflow-hidden" : ""}`}
                    style={{ clipPath: useTornEdge ? tornClip(index) : undefined }}
                  >
                    <ResponsiveImage
                      photo={photo}
                      sizes="(min-width: 768px) 34vw, 50vw"
                      priority={index < 2}
                      className={`block w-full ${position.aspectClass}`}
                      imgClassName="block h-full w-full object-cover transition-[filter] duration-500 group-hover:brightness-105"
                    />
                    {showCaptions && frames === "matte" && (
                      <span
                        className={`font-cormorant block px-1 pt-2 text-sm font-semibold ${classes.frameText}`}
                      >
                        {captionFor(photo, index)}
                      </span>
                    )}
                    {pins && index !== 0 && (
                      <span
                        aria-hidden="true"
                        className="absolute left-2 top-2 h-4 w-4 rounded-full border border-black/20 bg-white/65 shadow-sm backdrop-blur-sm"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {cleanText(noteBottom) && (
            <p className="font-cormorant relative z-30 mt-7 text-center text-lg font-semibold md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:w-full md:-translate-x-1/2 md:pb-2">
              {noteBottom}
            </p>
          )}
        </div>

        {(cleanText(noteLeft) || cleanText(noteRight)) && (
          <div className="mt-6 space-y-3 md:hidden">
            {cleanText(noteLeft) && <p className="font-caveat text-2xl">{noteLeft}</p>}
            {cleanText(noteRight) && (
              <p
                className={`font-cormorant border-l-2 pl-3 text-base font-semibold ${classes.muted}`}
              >
                {noteRight}
              </p>
            )}
          </div>
        )}

        <div
          className={`font-josefin mt-8 flex items-center gap-4 border-t pt-2 text-[10px] uppercase tracking-[0.14em] ${classes.rule} ${classes.muted}`}
        >
          <span>
            {visiblePhotos.length} {visiblePhotos.length === 1 ? "image" : "images"}
          </span>
          <span className="border-current/30 h-px flex-1 border-t" />
          <span>Curated edit</span>
        </div>
      </div>
    </section>
  );
}
