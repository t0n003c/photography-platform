import { createHash } from "node:crypto";
import sharp from "sharp";
import { requireRole } from "@/src/auth/session";
import {
  accepted,
  problem,
  notFound,
  conflict,
} from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { getStorage } from "@/src/storage";
import { stagingChunkKey, originalKey } from "@/src/storage/keys";
import { sniffImage, MAX_PIXELS } from "@/src/image/validate";
import { getUploadSession, deleteUploadSession } from "@/src/upload/session";
import { getImageQueue } from "@/src/queue/queues";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\\x00-\x1f]/g, "_").slice(0, 255) || "upload";
}

// POST /api/v1/admin/uploads/{uploadId}/complete — assemble, validate, persist
// original, create photo row, enqueue the sharp pipeline (API-DESIGN §6.1).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ uploadId: string }> },
) {
  const auth = await requireRole("staff");
  if (auth.error) return auth.error;

  const { uploadId } = await params;
  const session = await getUploadSession(uploadId);
  if (!session || session.ownerId !== auth.session.user.id) return notFound();

  if (session.received.length !== session.totalChunks) {
    return problem(409, "INCOMPLETE_UPLOAD", "Not all chunks were received.");
  }

  const storage = getStorage();

  // Assemble chunks in order.
  const parts: Buffer[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    parts.push(await storage.get(stagingChunkKey(uploadId, i)));
  }
  const assembled = Buffer.concat(parts);

  if (assembled.byteLength !== session.byteSize) {
    return problem(409, "SIZE_MISMATCH", "Assembled size does not match.");
  }
  if (session.checksum) {
    const want = session.checksum.replace(/^sha256:/, "");
    const got = createHash("sha256").update(assembled).digest("hex");
    if (want !== got) {
      return conflict("CHECKSUM_MISMATCH", "Checksum verification failed.");
    }
  }

  // Trust magic bytes, not the declared content type (SECURITY.md §6).
  const sniff = sniffImage(assembled);
  if (!sniff) {
    return problem(415, "UNSUPPORTED_MEDIA_TYPE", "File is not a supported image.");
  }

  let meta;
  try {
    meta = await sharp(assembled, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch {
    return problem(422, "UNREADABLE_IMAGE", "Image could not be decoded.");
  }
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0) {
    return problem(422, "UNREADABLE_IMAGE", "Image has no dimensions.");
  }

  const photoId = newId();
  const key = originalKey(photoId, sniff.ext);
  await storage.put(key, assembled, { contentType: sniff.mime });

  await db.insert(photo).values({
    id: photoId,
    ownerId: auth.session.user.id,
    originalStorageKey: key,
    filename: sanitizeFilename(session.filename),
    mimeType: sniff.mime,
    byteSize: assembled.byteLength,
    width,
    height,
    processingStatus: "pending",
  });

  // Enqueue with jobId = photoId for idempotency (API-DESIGN §6.2).
  await getImageQueue().add(
    "process-image",
    { photoId, originalKey: key, contentType: sniff.mime },
    { jobId: photoId },
  );

  // Clean staging.
  await Promise.all(
    Array.from({ length: session.totalChunks }, (_, i) =>
      storage.delete(stagingChunkKey(uploadId, i)).catch(() => {}),
    ),
  );
  await deleteUploadSession(uploadId);

  await writeAudit({
    actorId: auth.session.user.id,
    action: "photo.upload",
    entityType: "photo",
    entityId: photoId,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { filename: session.filename, byteSize: assembled.byteLength },
  });

  return accepted({
    photo: { id: photoId, processingStatus: "pending" },
    job: { id: photoId, queue: "image-processing" },
  });
}
