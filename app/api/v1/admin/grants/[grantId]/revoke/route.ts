import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { galleryAccessGrant } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// POST — revoke a grant.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ grantId: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { grantId } = await ctx.params;

  const rows = await db
    .select({ id: galleryAccessGrant.id })
    .from(galleryAccessGrant)
    .where(eq(galleryAccessGrant.id, grantId))
    .limit(1);
  if (!rows.length) return notFound();

  await db
    .update(galleryAccessGrant)
    .set({ revokedAt: new Date() })
    .where(eq(galleryAccessGrant.id, grantId));

  await writeAudit({
    actorId: a.session.user.id,
    action: "grant.revoke",
    entityType: "gallery_access_grant",
    entityId: grantId,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return ok({ id: grantId, revoked: true });
}
