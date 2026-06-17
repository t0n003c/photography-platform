import { api } from "@/src/lib/api-client";

// Browser-side resumable chunked upload driving the admin upload API
// (init → chunk → complete). Reports progress 0..1 per file. Chunks are sent
// with XMLHttpRequest so upload.onprogress gives smooth byte-level progress —
// fetch() does not expose request upload progress, which made the bar appear to
// do nothing for sub-chunk (single-chunk) files.
const CHUNK_SIZE = 5 * 1024 * 1024;

interface InitResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
}

// Reject a promise if it doesn't settle in time — turns a silent hang into a
// visible, labeled error in the upload row.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms,
      ),
    ),
  ]);
}

// PUT a chunk and report this chunk's progress fraction (0..1) as it uploads.
function putChunk(
  url: string,
  blob: Blob,
  onChunkProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.timeout = 120_000;
    xhr.setRequestHeader("content-type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onChunkProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Chunk failed (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during chunk upload"));
    xhr.ontimeout = () => reject(new Error("Chunk upload timed out"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(blob);
  });
}

export async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ photoId: string }> {
  const init = await withTimeout(
    api.post<InitResponse>("/api/v1/admin/uploads/init", {
      filename: file.name,
      byteSize: file.size,
      mimeType: file.type || "application/octet-stream",
      chunkSize: CHUNK_SIZE,
    }),
    30_000,
    "Starting upload (init)",
  );

  const { uploadId, chunkSize, totalChunks } = init;
  const chunks = Math.max(1, totalChunks);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const blob = file.slice(start, Math.min(file.size, start + chunkSize));
    // Overall fraction = completed chunks + the in-flight chunk's progress.
    await putChunk(
      `/api/v1/admin/uploads/${uploadId}/chunks/${i}`,
      blob,
      (frac) => onProgress?.((i + frac) / chunks),
    );
    onProgress?.((i + 1) / chunks);
  }

  // Processing (sharp → variants) happens in the worker; cap the bar at ~95%
  // until complete returns so it doesn't sit at 100% while still "processing".
  onProgress?.(0.97);
  const done = await withTimeout(
    api.post<{ photo: { id: string } }>(
      `/api/v1/admin/uploads/${uploadId}/complete`,
      {},
    ),
    60_000,
    "Finalizing upload",
  );
  onProgress?.(1);
  return { photoId: done.photo.id };
}
