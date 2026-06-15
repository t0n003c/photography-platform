import { requireRole } from "@/src/auth/session";
import { ok, problem, notFound } from "@/src/lib/http";
import { getStorage } from "@/src/storage";
import { stagingChunkKey } from "@/src/storage/keys";
import { getUploadSession, markChunkReceived } from "@/src/upload/session";

// PUT /api/v1/admin/uploads/{uploadId}/chunks/{index} — stage one chunk.
// Raw binary body. Duplicate indices are idempotent (API-DESIGN §6.1).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ uploadId: string; index: string }> },
) {
  const auth = await requireRole("staff");
  if (auth.error) return auth.error;

  const { uploadId, index } = await params;
  const idx = Number.parseInt(index, 10);

  const session = await getUploadSession(uploadId);
  if (!session || session.ownerId !== auth.session.user.id) return notFound();
  if (!Number.isInteger(idx) || idx < 0 || idx >= session.totalChunks) {
    return problem(400, "BAD_CHUNK_INDEX", "Chunk index out of range.");
  }

  const body = Buffer.from(await req.arrayBuffer());
  if (body.byteLength === 0) {
    return problem(400, "EMPTY_CHUNK", "Chunk body is empty.");
  }
  if (body.byteLength > session.chunkSize) {
    return problem(413, "CHUNK_TOO_LARGE", "Chunk exceeds negotiated size.");
  }

  await getStorage().put(stagingChunkKey(uploadId, idx), body);
  const updated = await markChunkReceived(uploadId, idx);
  if (!updated) return notFound();

  const remaining = Array.from(
    { length: updated.totalChunks },
    (_, i) => i,
  ).filter((i) => !updated.received.includes(i));

  return ok({
    uploadId,
    receivedChunks: updated.received,
    remaining,
  });
}
