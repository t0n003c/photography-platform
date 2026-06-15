import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { generateShareToken } from "@/src/auth/grant";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { galleryAccessGrant } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// POST — rotate a grant's token (new shareUrl shown once).
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

  const { raw, hash } = generateShareToken();
  await db
    .update(galleryAccessGrant)
    .set({ tokenHash: hash })
    .where(eq(galleryAccessGrant.id, grantId));

  await writeAudit({
    actorId: a.session.user.id,
    action: "grant.rotate",
    entityType: "gallery_access_grant",
    entityId: grantId,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return ok({
    grant: { id: grantId },
    shareUrl: `${getEnv().APP_BASE_URL}/g/${raw}`,
    tokenShownOnce: true,
  });
}
