import { sql, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { photo, photoVariant } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// GET — object-storage usage, derived from the DB (sum of stored byte sizes)
// rather than listing SeaweedFS. This is what makes storage usage visible on
// the dashboard so there's no need to open the SeaweedFS UI directly.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  // Originals (exclude soft-deleted) + all derived variants (webp/jpeg/avif).
  const [originals] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${photo.byteSize}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(photo)
    .where(isNull(photo.deletedAt));

  const [variants] = await db
    .select({
      bytes: sql<number>`coalesce(sum(${photoVariant.byteSize}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(photoVariant);

  const originalBytes = Number(originals?.bytes ?? 0);
  const variantBytes = Number(variants?.bytes ?? 0);

  return ok({
    data: {
      originalBytes,
      variantBytes,
      totalBytes: originalBytes + variantBytes,
      photoCount: Number(originals?.count ?? 0),
      variantCount: Number(variants?.count ?? 0),
    },
  });
}
