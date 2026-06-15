// StorageProvider — the seam every call site depends on. Drivers (MinIO/S3 by
// default, filesystem alternate) implement this; nothing imports a driver
// directly. See docs/MEDIA-ARCHITECTURE.md.
export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface StorageProvider {
  /** Store bytes at an opaque key (originals + derivatives). */
  put(key: string, body: Buffer | Uint8Array, opts?: PutOptions): Promise<void>;
  /** Fetch bytes for a key. */
  get(key: string): Promise<Buffer>;
  /** Delete an object (no error if absent). */
  delete(key: string): Promise<void>;
  /** Whether an object exists. */
  exists(key: string): Promise<boolean>;
  /** Time-limited signed URL for private/direct access. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
