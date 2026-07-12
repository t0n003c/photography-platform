import { z } from "zod";
import { and, eq, isNull, desc, sql } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, notFound, parseJson, ok } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { generateShareToken } from "@/src/auth/grant";
import { hashPassword } from "@/src/lib/password";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { gallery, galleryAccessGrant, client } from "@/src/db/schema";
import { enqueueEmail } from "@/src/email/send";
import { galleryInvite } from "@/src/email/templates";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  clientId: z.string().nullable().optional(),
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
  sendInvite: z.boolean().default(false),
});

// GET — list grants for a gallery (token_hash excluded).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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
      hasPassword: sql<boolean>`${galleryAccessGrant.passwordHash} is not null`,
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
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const exists = await db
    .select({ id: gallery.id, title: gallery.title, shootDate: gallery.shootDate })
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

  const shareUrl = `${getEnv().APP_BASE_URL}/g/${raw}`;

  if (body.sendInvite && body.clientId) {
    const c = await db
      .select({ email: client.email, name: client.name })
      .from(client)
      .where(eq(client.id, body.clientId))
      .limit(1);
    if (c[0]?.email) {
      await enqueueEmail(
        galleryInvite({
          to: c[0].email,
          clientName: c[0].name,
          galleryTitle: exists[0]!.title,
          shareUrl,
          password: body.password,
          shootDate: exists[0]!.shootDate,
          expiresAt,
          permissions: {
            favorite: body.permissions?.favorite ?? true,
            download: body.permissions?.download ?? false,
          },
        }),
      );
    }
  }

  return created({
    grant: {
      id: grantId,
      galleryId: id,
      clientId: body.clientId ?? null,
      label: body.label ?? null,
      canView: body.permissions?.view ?? true,
      canFavorite: body.permissions?.favorite ?? true,
      canDownload: body.permissions?.download ?? false,
      expiresAt,
      revokedAt: null,
      lastAccessedAt: null,
      accessCount: 0,
      hasPassword: Boolean(passwordHash),
    },
    shareUrl,
    tokenShownOnce: true,
  });
}
