import { and, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { accepted, notFound } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";
import { getImageQueue } from "@/src/queue/queues";

export const dynamic = "force-dynamic";

// POST /api/v1/admin/photos/{id}/reprocess — re-run the sharp pipeline.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("staff");
  if (a.error) return a.error;

  const { id } = await ctx.params;
  const rows = await db
    .select()
    .from(photo)
    .where(and(eq(photo.id, id), isNull(photo.deletedAt)))
    .limit(1);
  const p = rows[0];
  if (!p) return notFound();

  await db
    .update(photo)
    .set({ processingStatus: "pending", processingError: null })
    .where(eq(photo.id, id));

  await getImageQueue().add(
    "process-image",
    { photoId: id, originalKey: p.originalStorageKey, contentType: p.mimeType },
    { jobId: id },
  );

  await writeAudit({
    actorId: a.session.user.id,
    action: "photo.reprocess",
    entityType: "photo",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return accepted({ photo: { id, processingStatus: "pending" } });
}
