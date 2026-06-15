// @ts-nocheck — Remotion compositions compile under Remotion's own bundler,
// not the app tsc (its module resolution differs). The render is verified live.
import React from "react";
import { Composition } from "remotion";
import {
  GallerySlideshow,
  FRAMES_PER_PHOTO,
  CROSSFADE,
  type SlideshowProps,
} from "./GallerySlideshow";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="GallerySlideshow"
      component={GallerySlideshow}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={FRAMES_PER_PHOTO}
      defaultProps={{ frames: [], title: "" } satisfies SlideshowProps}
      calculateMetadata={({ props }) => ({
        durationInFrames:
          Math.max(1, props.frames.length) * (FRAMES_PER_PHOTO - CROSSFADE) +
          CROSSFADE,
      })}
    />
  );
};
