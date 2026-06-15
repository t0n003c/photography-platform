import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { hashPassword } from "@/src/lib/password";
import { db } from "@/src/db/client";
import { galleryAccessGrant } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  label: z.string().nullable().optional(),
  permissions: z
    .object({
      view: z.boolean().optional(),
      favorite: z.boolean().optional(),
      download: z.boolean().optional(),
    })
    .optional(),
  password: z.string().min(1).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

// PATCH — update a grant.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ grantId: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { grantId } = await ctx.params;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const rows = await db
    .select({ id: galleryAccessGrant.id })
    .from(galleryAccessGrant)
    .where(eq(galleryAccessGrant.id, grantId))
    .limit(1);
  if (!rows.length) return notFound();

  const updates: Partial<typeof galleryAccessGrant.$inferInsert> = {};
  if (body.label !== undefined) updates.label = body.label;
  if (body.permissions?.view !== undefined) updates.canView = body.permissions.view;
  if (body.permissions?.favorite !== undefined)
    updates.canFavorite = body.permissions.favorite;
  if (body.permissions?.download !== undefined)
    updates.canDownload = body.permissions.download;
  if (body.password !== undefined)
    updates.passwordHash = body.password ? await hashPassword(body.password) : null;
  if (body.expiresAt !== undefined)
    updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  await db
    .update(galleryAccessGrant)
    .set(updates)
    .where(eq(galleryAccessGrant.id, grantId));

  await writeAudit({
    actorId: a.session.user.id,
    action: "grant.update",
    entityType: "gallery_access_grant",
    entityId: grantId,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id: grantId });
}
