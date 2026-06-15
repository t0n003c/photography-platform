import { and, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, accepted, notFound, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";
import { getVideoQueue } from "@/src/queue/queues";

export const dynamic = "force-dynamic";

async function loadGallery(id: string) {
  const rows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// GET — current slideshow-video status.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const g = await loadGallery(id);
  if (!g) return notFound();

  return ok({
    video: {
      status: g.videoStatus,
      generatedAt: g.videoGeneratedAt ? g.videoGeneratedAt.toISOString() : null,
      enabled: getEnv().VIDEO_RENDER_ENABLED,
      url:
        g.videoStatus === "ready"
          ? `/api/v1/admin/galleries/${id}/video/file`
          : null,
    },
  });
}

// POST — enqueue a slideshow-video render (opt-in feature).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const g = await loadGallery(id);
  if (!g) return notFound();

  if (!getEnv().VIDEO_RENDER_ENABLED) {
    return problem(
      501,
      "VIDEO_DISABLED",
      "Slideshow video rendering is not enabled on this deployment.",
    );
  }

  await db
    .update(gallery)
    .set({ videoStatus: "pending" })
    .where(eq(gallery.id, id));
  await getVideoQueue().add(
    "render",
    { galleryId: id },
    { jobId: `video-${id}` },
  );

  await writeAudit({
    actorId: a.session.user.id,
    action: "gallery.video.render",
    entityType: "gallery",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return accepted({ video: { status: "pending" } });
}
