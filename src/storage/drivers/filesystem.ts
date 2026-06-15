import { promises as fs } from "node:fs";
import path from "node:path";
import { getEnv } from "@/src/lib/env";
import type { PutOptions, StorageProvider } from "@/src/storage/provider";

// Alternate driver — stores objects on a mounted volume. Selected via
// STORAGE_DRIVER=filesystem. Signed URLs are not applicable; private access
// is mediated by the app, which streams bytes itself.
export class FilesystemStorageProvider implements StorageProvider {
  private readonly root: string;

  constructor() {
    this.root = getEnv().STORAGE_FS_PATH;
  }

  private resolve(key: string): string {
    // Prevent path traversal out of the storage root.
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root))) {
      throw new Error("Invalid storage key");
    }
    return full;
  }

  async put(
    key: string,
    body: Buffer | Uint8Array,
    _opts?: PutOptions,
  ): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string): Promise<string> {
    // No native signing; the app serves these through an authorized route.
    return `/api/media/${encodeURIComponent(key)}`;
  }
}
