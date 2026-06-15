import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db/client";
import { download, photoVariant } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import {
  ok,
  accepted,
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

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["single", "zip"]),
  photoId: z.string().optional(),
  variant: z.string().optional(),
  selection: z.array(z.string()).optional(),
});

// POST /api/v1/g/:token/download — record a download and hand back a media URL
// (single) or kick off a zip build job (zip). canDownload is required.
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
  const { kind, photoId, variant } = parsed.data;

  const ip = clientIp(req);
  const ua = userAgent(req);

  if (kind === "single") {
    const rl = await rateLimit(`gdl:single:${grant.id}`, 60, 3600);
    if (!rl.ok) return tooMany(rl.retryAfter);

    if (!photoId) {
      return problem(422, "VALIDATION_ERROR", "photoId is required for single downloads.");
    }
    if (!(await grantAuthorizesPhoto(grant, photoId))) return notFound();

    // Pick a delivery variant: prefer webp at large/xlarge.
    const vrows = await db
      .select()
      .from(photoVariant)
      .where(eq(photoVariant.photoId, photoId));
    if (vrows.length === 0) {
      return problem(409, "NOT_READY", "This photo is not ready for download yet.");
    }
    const pick =
      vrows.find(
        (v) =>
          v.format === "webp" &&
          (v.sizeBucket === "xlarge" || v.sizeBucket === "large"),
      ) ??
      vrows.find((v) => v.sizeBucket === "xlarge" || v.sizeBucket === "large") ??
      vrows[0];

    const id = newId();
    await db.insert(download).values({
      id,
      kind: "single",
      status: "ready",
      grantId: grant.id,
      galleryId: grant.galleryId,
      clientId: grant.clientId,
      photoId,
      variant: variant ?? pick.sizeBucket,
      ipAddress: ip,
      userAgent: ua,
    });

    return ok({
      download: { id, status: "ready" },
      url: `/api/v1/media/v/${pick.id}?t=${encodeURIComponent(token)}`,
    });
  }

  // kind === "zip"
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
    ipAddress: ip,
    userAgent: ua,
  });

  // DEFERRED: the actual zip-build worker (bundling the selection into an
  // archive and flipping status -> "ready"/"failed") is a later phase. The row
  // stays "building" until that worker runs; clients poll the URL below.
  return accepted({
    download: { id, status: "building", kind: "zip" },
    poll: `/api/v1/g/${token}/download/${id}`,
  });
}
