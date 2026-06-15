import { and, eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { download } from "@/src/db/schema";
import { resolveGrant } from "@/src/auth/grant";
import { notFound, forbidden, gone, problem } from "@/src/lib/http";
import { getStorage } from "@/src/storage";

export const dynamic = "force-dynamic";

// GET — stream the built ZIP of originals for a download, scoped to its grant.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string; downloadId: string }> },
) {
  const { token, downloadId } = await ctx.params;
  const grant = await resolveGrant(token);
  if (!grant) return notFound();
  if (!grant.canDownload) return forbidden();

  const rows = await db
    .select()
    .from(download)
    .where(and(eq(download.id, downloadId), eq(download.grantId, grant.id)))
    .limit(1);
  const d = rows[0];
  if (!d) return notFound();
  if (d.status === "building") {
    return problem(409, "NOT_READY", "Your download is still being prepared.");
  }
  if (d.status !== "ready" || !d.resultStorageKey) return notFound();
  if (d.expiresAt && d.expiresAt.getTime() <= Date.now()) {
    return gone("DOWNLOAD_EXPIRED", "This download link has expired.");
  }

  const bytes = await getStorage().get(d.resultStorageKey);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="gallery-${d.id}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
