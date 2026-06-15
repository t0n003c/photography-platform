// Shared video-render job contract (producer: admin gallery video route;
// consumer: worker, Remotion). Opt-in feature (VIDEO_RENDER_ENABLED).
export const VIDEO_QUEUE = "video-render" as const;

export interface RenderVideoJob {
  galleryId: string;
}
