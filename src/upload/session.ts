import { getRedis } from "@/src/redis/client";

// Resumable-upload session state (API-DESIGN §6). Lives in Redis with a TTL so
// abandoned uploads self-clean; chunk bytes are staged via the StorageProvider.
export interface UploadSession {
  uploadId: string;
  ownerId: string;
  filename: string;
  byteSize: number;
  mimeType: string;
  chunkSize: number;
  totalChunks: number;
  checksum: string | null;
  received: number[];
  createdAt: number;
}

const TTL_SEC = 6 * 60 * 60;
const key = (id: string) => `upload:${id}`;

export async function createUploadSession(s: UploadSession): Promise<void> {
  await getRedis().set(key(s.uploadId), JSON.stringify(s), "EX", TTL_SEC);
}

export async function getUploadSession(
  id: string,
): Promise<UploadSession | null> {
  const raw = await getRedis().get(key(id));
  return raw ? (JSON.parse(raw) as UploadSession) : null;
}

export async function markChunkReceived(
  id: string,
  index: number,
): Promise<UploadSession | null> {
  const s = await getUploadSession(id);
  if (!s) return null;
  if (!s.received.includes(index)) {
    s.received.push(index);
    s.received.sort((a, b) => a - b);
    await getRedis().set(key(id), JSON.stringify(s), "EX", TTL_SEC);
  }
  return s;
}

export async function deleteUploadSession(id: string): Promise<void> {
  await getRedis().del(key(id));
}
