import { api } from "@/src/lib/api-client";

// Browser-side resumable chunked upload driving the admin upload API
// (init → chunk → complete). Reports progress 0..1 per file.
const CHUNK_SIZE = 5 * 1024 * 1024;

interface InitResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
}

export async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ photoId: string }> {
  const init = await api.post<InitResponse>("/api/v1/admin/uploads/init", {
    filename: file.name,
    byteSize: file.size,
    mimeType: file.type || "application/octet-stream",
    chunkSize: CHUNK_SIZE,
  });

  const { uploadId, chunkSize, totalChunks } = init;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const blob = file.slice(start, Math.min(file.size, start + chunkSize));
    const res = await fetch(
      `/api/v1/admin/uploads/${uploadId}/chunks/${i}`,
      {
        method: "PUT",
        headers: { "content-type": "application/octet-stream" },
        body: blob,
      },
    );
    if (!res.ok) throw new Error(`Chunk ${i} failed (${res.status})`);
    onProgress?.((i + 1) / totalChunks);
  }

  const done = await api.post<{ photo: { id: string } }>(
    `/api/v1/admin/uploads/${uploadId}/complete`,
    {},
  );
  return { photoId: done.photo.id };
}
