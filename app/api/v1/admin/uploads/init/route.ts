import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { parseJson, problem, created, tooMany } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { newId } from "@/src/lib/id";
import {
  MAX_UPLOAD_BYTES,
  isAllowedMime,
} from "@/src/image/validate";
import { createUploadSession } from "@/src/upload/session";

const DEFAULT_CHUNK = 5 * 1024 * 1024;

const InitSchema = z.object({
  filename: z.string().min(1).max(255),
  byteSize: z.number().int().positive(),
  mimeType: z.string().min(1),
  checksum: z.string().optional(),
  chunkSize: z.number().int().positive().optional(),
});

// POST /api/v1/admin/uploads/init — begin a resumable upload (API-DESIGN §6.1).
export async function POST(req: Request) {
  const auth = await requireRole("staff");
  if (auth.error) return auth.error;

  const rl = await rateLimit(`upload:${auth.session.user.id}`, 1200, 60);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = await parseJson(req, InitSchema);
  if ("error" in parsed) return parsed.error;
  const { filename, byteSize, mimeType, checksum, chunkSize } = parsed.data;

  if (!isAllowedMime(mimeType)) {
    return problem(415, "UNSUPPORTED_MEDIA_TYPE", "Unsupported image type.");
  }
  if (byteSize > MAX_UPLOAD_BYTES) {
    return problem(413, "PAYLOAD_TOO_LARGE", "File exceeds the size limit.");
  }

  const size = chunkSize && chunkSize > 0 ? chunkSize : DEFAULT_CHUNK;
  const totalChunks = Math.max(1, Math.ceil(byteSize / size));
  const uploadId = newId();

  await createUploadSession({
    uploadId,
    ownerId: auth.session.user.id,
    filename,
    byteSize,
    mimeType,
    chunkSize: size,
    totalChunks,
    checksum: checksum ?? null,
    received: [],
    createdAt: Date.now(),
  });

  return created({
    uploadId,
    chunkSize: size,
    totalChunks,
    receivedChunks: [],
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  });
}
