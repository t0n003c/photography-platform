import { requireRole } from "@/src/auth/session";
import { ok, notFound, noContent } from "@/src/lib/http";
import { getStorage } from "@/src/storage";
import { stagingChunkKey } from "@/src/storage/keys";
import {
  getUploadSession,
  deleteUploadSession,
} from "@/src/upload/session";

// GET — upload status / resume (which chunks were received).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const auth = await requireRole("staff");
  if (auth.error) return auth.error;
  const { uploadId } = await params;
  const session = await getUploadSession(uploadId);
  if (!session || session.ownerId !== auth.session.user.id) return notFound();

  const remaining = Array.from(
    { length: session.totalChunks },
    (_, i) => i,
  ).filter((i) => !session.received.includes(i));

  return ok({
    uploadId,
    totalChunks: session.totalChunks,
    receivedChunks: session.received,
    remaining,
  });
}

// DELETE — abort + clean staged parts.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const auth = await requireRole("staff");
  if (auth.error) return auth.error;
  const { uploadId } = await params;
  const session = await getUploadSession(uploadId);
  if (!session || session.ownerId !== auth.session.user.id) return notFound();

  const storage = getStorage();
  await Promise.all(
    Array.from({ length: session.totalChunks }, (_, i) =>
      storage.delete(stagingChunkKey(uploadId, i)).catch(() => {}),
    ),
  );
  await deleteUploadSession(uploadId);
  return noContent();
}
