import { getEnv } from "@/src/lib/env";
import type { StorageProvider } from "@/src/storage/provider";
import { MinioStorageProvider } from "@/src/storage/drivers/minio";
import { FilesystemStorageProvider } from "@/src/storage/drivers/filesystem";

export type { StorageProvider } from "@/src/storage/provider";

let provider: StorageProvider | null = null;

// Driver selection happens once, here. Call sites use getStorage() only.
export function getStorage(): StorageProvider {
  if (provider) return provider;
  provider =
    getEnv().STORAGE_DRIVER === "filesystem"
      ? new FilesystemStorageProvider()
      : new MinioStorageProvider();
  return provider;
}
