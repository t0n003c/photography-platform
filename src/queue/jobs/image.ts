// Shared job contract — imported by BOTH the producer (app/api/uploads) and the
// consumer (worker/index.ts). Typing it once prevents producer/consumer drift.

export const IMAGE_QUEUE = "image-processing" as const;

export interface ProcessImageJob {
  /** Photo row id; also used as the BullMQ jobId for idempotency. */
  photoId: string;
  /** Storage key of the uploaded original. */
  originalKey: string;
  /** Original content type, as validated at upload time. */
  contentType: string;
}

export type ImageJobName = "process-image";
