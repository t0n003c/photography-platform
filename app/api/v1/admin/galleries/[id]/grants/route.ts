import { z } from "zod";
import { and, eq, isNull, desc } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, notFound, parseJson, ok } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { generateShareToken } from "@/src/auth/grant";
import { hashPassword } from "@/src/lib/password";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { gallery, galleryAccessGrant } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  clientId: z.string().optional(),
  label: z.string().optional(),
  permissions: z
    .object({
      view: z.boolean().optional(),
      favorite: z.boolean().optional(),
      download: z.boolean().optional(),
    })
    .optional(),
  password: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

// GET — list grants for a gallery (token_hash excluded).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({
      id: galleryAccessGrant.id,
      galleryId: galleryAccessGrant.galleryId,
      clientId: galleryAccessGrant.clientId,
      label: galleryAccessGrant.label,
      canView: galleryAccessGrant.canView,
      canFavorite: galleryAccessGrant.canFavorite,
      canDownload: galleryAccessGrant.canDownload,
      expiresAt: galleryAccessGrant.expiresAt,
      revokedAt: galleryAccessGrant.revokedAt,
      lastAccessedAt: galleryAccessGrant.lastAccessedAt,
      accessCount: galleryAccessGrant.accessCount,
      createdBy: galleryAccessGrant.createdBy,
      createdAt: galleryAccessGrant.createdAt,
      updatedAt: galleryAccessGrant.updatedAt,
    })
    .from(galleryAccessGrant)
    .where(eq(galleryAccessGrant.galleryId, id))
    .orderBy(desc(galleryAccessGrant.createdAt));

  return ok({ data: rows });
}

// POST — create a share grant (token shown once).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const exists = await db
    .select({ id: gallery.id })
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  if (!exists.length) return notFound();

  const { raw, hash } = generateShareToken();
  const passwordHash = body.password ? await hashPassword(body.password) : null;
  const grantId = newId();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  await db.insert(galleryAccessGrant).values({
    id: grantId,
    galleryId: id,
    clientId: body.clientId ?? null,
    tokenHash: hash,
    label: body.label ?? null,
    canView: body.permissions?.view ?? true,
    canFavorite: body.permissions?.favorite ?? true,
    canDownload: body.permissions?.download ?? false,
    passwordHash,
    expiresAt,
    createdBy: a.session.user.id,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "grant.create",
    entityType: "gallery_access_grant",
    entityId: grantId,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { galleryId: id },
  });

  return created({
    grant: { id: grantId, galleryId: id, expiresAt },
    shareUrl: `${getEnv().APP_BASE_URL}/g/${raw}`,
    tokenShownOnce: true,
  });
}
