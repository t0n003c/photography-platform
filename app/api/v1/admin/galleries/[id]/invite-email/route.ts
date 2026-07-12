import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { db } from "@/src/db/client";
import { client, gallery } from "@/src/db/schema";
import { loadClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { getGalleryPhotos } from "@/src/db/queries/public";
import { getSiteSettings } from "@/src/db/queries/settings";
import { enqueueEmail } from "@/src/email/send";
import { galleryInvite } from "@/src/email/templates";
import { getEnv } from "@/src/lib/env";
import { ok, notFound, parseJson, problem } from "@/src/lib/http";
import { writeAudit } from "@/src/lib/audit";
import { clientIp, userAgent } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const InviteEmailSchema = z.object({
  clientId: z.string().nullable().optional(),
  to: z.string().email().optional(),
  clientName: z.string().max(200).nullable().optional(),
  shareUrl: z.string().url().max(1000),
  message: z.string().max(2000).nullable().optional(),
  password: z.string().max(200).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  permissions: z
    .object({
      favorite: z.boolean().optional(),
      download: z.boolean().optional(),
    })
    .optional(),
  send: z.boolean().default(false),
});

function normalizeShareUrl(value: string): string | null {
  try {
    const app = new URL(getEnv().APP_BASE_URL);
    const url = new URL(value);
    if (url.origin !== app.origin) return null;
    if (!url.pathname.startsWith("/g/")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function shareTokenFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/g\/([^/]+)$/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function appUrl(path: string): string {
  return new URL(path, getEnv().APP_BASE_URL).toString();
}

function choosePreviewVariant(
  photos: Awaited<ReturnType<typeof getGalleryPhotos>>["photos"],
) {
  const variants = photos[0]?.variants ?? [];
  return (
    variants.find((v) => v.format === "jpeg" && v.sizeBucket === "large") ??
    variants.find((v) => v.format === "jpeg" && v.sizeBucket === "medium") ??
    variants.find((v) => v.sizeBucket === "large") ??
    variants.find((v) => v.sizeBucket === "medium") ??
    variants[0] ??
    null
  );
}

// POST - build or send a client-facing gallery invitation email for a newly
// created/rotated share URL. Raw share tokens are intentionally not stored.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, InviteEmailSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const shareUrl = normalizeShareUrl(body.shareUrl);
  if (!shareUrl) {
    return problem(
      422,
      "INVALID_SHARE_URL",
      "Share URL must be a gallery share link for this site.",
    );
  }
  const shareToken = shareTokenFromUrl(shareUrl);
  if (!shareToken) {
    return problem(
      422,
      "INVALID_SHARE_URL",
      "Share URL must be a gallery share link for this site.",
    );
  }

  const galleries = await db
    .select({
      id: gallery.id,
      title: gallery.title,
      shootDate: gallery.shootDate,
    })
    .from(gallery)
    .where(and(eq(gallery.id, id), isNull(gallery.deletedAt)))
    .limit(1);
  const g = galleries[0];
  if (!g) return notFound();

  const access = await loadClientGalleryAccess(shareToken);
  if ("res" in access || access.access.gallery.id !== id) {
    return problem(
      422,
      "INVALID_SHARE_URL",
      "Share URL must be an active share link for this gallery.",
    );
  }

  let to = body.to ?? "";
  let clientName = body.clientName ?? null;
  if (body.clientId) {
    const clients = await db
      .select({ email: client.email, name: client.name })
      .from(client)
      .where(and(eq(client.id, body.clientId), isNull(client.deletedAt)))
      .limit(1);
    if (clients[0]) {
      to = clients[0].email;
      clientName = clients[0].name;
    }
  }
  if (!to) {
    return problem(
      422,
      "MISSING_RECIPIENT",
      "Choose a client or enter a recipient email.",
    );
  }

  const settings = await getSiteSettings();
  const previewVariant = access.access.requiresPassword
    ? null
    : choosePreviewVariant((await getGalleryPhotos(id, null, 1)).photos);
  const previewImageUrl = previewVariant
    ? (() => {
        const url = new URL(appUrl(previewVariant.url));
        url.searchParams.set("t", shareToken);
        return url.toString();
      })()
    : null;

  const email = galleryInvite({
    to,
    clientName,
    galleryTitle: g.title,
    shareUrl,
    siteTitle: settings.siteTitle,
    logoUrl: settings.logoStorageKey
      ? appUrl("/api/v1/media/site-logo")
      : appUrl("/icon.svg"),
    previewImageUrl,
    previewAlt: g.title,
    isPasswordProtected: access.access.requiresPassword,
    message: body.message,
    password: body.password,
    shootDate: g.shootDate,
    expiresAt: body.expiresAt,
    permissions: body.permissions,
  });

  if (body.send) {
    await enqueueEmail(email);
    await writeAudit({
      actorId: a.session.user.id,
      action: "gallery.invite.email",
      entityType: "gallery",
      entityId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
      metadata: {
        to,
        hasPassword: Boolean(body.password?.trim()),
        hasMessage: Boolean(body.message?.trim()),
      },
    });
  }

  return ok({
    data: {
      label: "Gallery invite email",
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
      sent: body.send,
    },
  });
}
