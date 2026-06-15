import { z } from "zod";
import { db } from "@/src/db/client";
import { download } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import {
  accepted,
  ok,
  notFound,
  forbidden,
  problem,
  tooMany,
  parseJson,
} from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { grantAuthorizesPhoto } from "@/src/db/queries/photos";
import { getZipQueue } from "@/src/queue/queues";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["single", "zip"]),
  photoId: z.string().optional(),
  // zip selection: the whole gallery or just this grant's favorites
  scope: z.enum(["all", "favorites"]).optional(),
});

// POST /api/v1/g/:token/download — downloads are ORIGINAL, full quality.
// single → an authorized original-file URL; zip → kick off a build of originals.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const grant = await resolveGrant(token);
  if (!grant) return notFound();
  if (!grant.canDownload) return forbidden();

  const parsed = await parseJson(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { kind, photoId, scope } = parsed.data;

  const ip = clientIp(req);
  const ua = userAgent(req);

  if (kind === "single") {
    const rl = await rateLimit(`gdl:single:${grant.id}`, 60, 3600);
    if (!rl.ok) return tooMany(rl.retryAfter);
    if (!photoId) {
      return problem(422, "VALIDATION_ERROR", "photoId is required for single downloads.");
    }
    if (!(await grantAuthorizesPhoto(grant, photoId))) return notFound();

    const id = newId();
    await db.insert(download).values({
      id,
      kind: "single",
      status: "ready",
      grantId: grant.id,
      galleryId: grant.galleryId,
      clientId: grant.clientId,
      photoId,
      variant: "original",
      ipAddress: ip,
      userAgent: ua,
    });

    return ok({
      download: { id, status: "ready" },
      url: `/api/v1/g/${token}/photos/${photoId}/original`,
    });
  }

  // kind === "zip" — build an archive of original files (1 concurrent / grant).
  const rl = await rateLimit(`gdl:zip:${grant.id}`, 5, 3600);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const id = newId();
  await db.insert(download).values({
    id,
    kind: "zip",
    status: "building",
    grantId: grant.id,
    galleryId: grant.galleryId,
    clientId: grant.clientId,
    variant: scope ?? "all",
    ipAddress: ip,
    userAgent: ua,
  });

  await getZipQueue().add("build", { downloadId: id }, { jobId: id });

  return accepted({
    download: { id, status: "building", kind: "zip" },
    poll: `/api/v1/g/${token}/download/${id}`,
  });
}
