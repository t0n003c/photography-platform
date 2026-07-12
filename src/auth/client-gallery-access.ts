import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";
import { resolveGrant, type Grant } from "@/src/auth/grant";
import { cookieName, verifyGallerySession } from "@/src/auth/gallery-session";
import { forbidden, notFound, problem } from "@/src/lib/http";

export type ClientGalleryPermission = "view" | "favorite" | "download";

export type ClientGallery = typeof gallery.$inferSelect;

export interface ClientGalleryAccess {
  grant: Grant;
  gallery: ClientGallery;
  passwordHash: string | null;
  requiresPassword: boolean;
}

export async function loadClientGalleryAccess(
  token: string,
): Promise<{ access: ClientGalleryAccess } | { res: Response }> {
  const grant = await resolveGrant(token);
  if (!grant) return { res: notFound() };

  const rows = await db
    .select()
    .from(gallery)
    .where(and(eq(gallery.id, grant.galleryId), isNull(gallery.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return { res: notFound() };

  const passwordHash = grant.passwordHash ?? row.passwordHash ?? null;
  return {
    access: {
      grant,
      gallery: row,
      passwordHash,
      requiresPassword: Boolean(passwordHash),
    },
  };
}

function hasPermission(grant: Grant, permission: ClientGalleryPermission) {
  if (!grant.canView) return false;
  if (permission === "favorite") return grant.canFavorite;
  if (permission === "download") return grant.canDownload;
  return true;
}

export async function requireClientGalleryAccess(
  token: string,
  {
    permission = "view",
    requireUnlock = true,
  }: {
    permission?: ClientGalleryPermission;
    requireUnlock?: boolean;
  } = {},
): Promise<{ access: ClientGalleryAccess } | { res: Response }> {
  const loaded = await loadClientGalleryAccess(token);
  if ("res" in loaded) return loaded;

  const { access } = loaded;
  if (!hasPermission(access.grant, permission)) return { res: forbidden() };

  if (requireUnlock && access.requiresPassword) {
    const cookie = (await cookies()).get(cookieName(access.grant.id))?.value;
    if (!verifyGallerySession(cookie, access.grant.id)) {
      return {
        res: problem(401, "GALLERY_LOCKED", "This gallery is password protected."),
      };
    }
  }

  return { access };
}
