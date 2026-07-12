import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { download } from "@/src/db/schema";
import { requireClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// GET /api/v1/g/:token/download/:downloadId — poll the status of a prior
// download request (notably zip builds).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string; downloadId: string }> },
) {
  const { token, downloadId } = await ctx.params;
  const resolved = await requireClientGalleryAccess(token, { permission: "view" });
  if ("res" in resolved) return resolved.res;
  const { grant } = resolved.access;

  const rows = await db
    .select()
    .from(download)
    .where(and(eq(download.id, downloadId), eq(download.grantId, grant.id)))
    .limit(1);
  const d = rows[0];
  if (!d) return notFound();

  // When a zip build is ready, hand back the authorized file URL.
  const url =
    d.status === "ready" && d.kind === "zip"
      ? `/api/v1/g/${token}/download/${d.id}/file`
      : null;

  return ok({
    download: {
      id: d.id,
      kind: d.kind,
      status: d.status,
      photoId: d.photoId,
      variant: d.variant,
      byteSize: d.byteSize,
      expiresAt: d.expiresAt ? d.expiresAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    },
    url,
  });
}
