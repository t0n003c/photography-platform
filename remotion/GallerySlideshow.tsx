// @ts-nocheck — Remotion compositions compile under Remotion's own bundler,
// not the app tsc (its module resolution differs). The render is verified live.
import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// A crossfading Ken-Burns slideshow of gallery photos. Images are provided to
// the bundle's public dir as f0.webp, f1.webp, … by src/video/render.ts.
export const FRAMES_PER_PHOTO = 90; // 3s @ 30fps
export const CROSSFADE = 20;

export interface SlideFrame {
  file: string;
  width: number;
  height: number;
}
export interface SlideshowProps {
  frames: SlideFrame[];
  title: string;
}

const Slide: React.FC<{ frame: SlideFrame }> = ({ frame }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    f,
    [0, CROSSFADE, durationInFrames - CROSSFADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const scale = interpolate(f, [0, durationInFrames], [1.06, 1.14]);
  return (
    <AbsoluteFill
      style={{ opacity, justifyContent: "center", alignItems: "center", overflow: "hidden" }}
    >
      <Img
        src={staticFile(frame.file)}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
      />
    </AbsoluteFill>
  );
};

export const GallerySlideshow: React.FC<SlideshowProps> = ({ frames }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {frames.map((frame, i) => (
        <Sequence
          key={i}
          from={i * (FRAMES_PER_PHOTO - CROSSFADE)}
          durationInFrames={FRAMES_PER_PHOTO}
        >
          <Slide frame={frame} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
