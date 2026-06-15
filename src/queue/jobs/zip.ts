// Shared zip-build job contract (producer: client-gallery download route;
// consumer: worker). Bundles ORIGINAL files at full quality.
export const ZIP_QUEUE = "zip-build" as const;

export interface BuildZipJob {
  downloadId: string;
}
