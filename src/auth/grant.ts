import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { galleryAccessGrant } from "@/src/db/schema";

// Client-gallery share-token auth (SECURITY.md §7, API-DESIGN §2.2). The raw
// token (≥128-bit) is shown once; only its SHA-256 hash is stored. A grant is
// active iff not revoked and not past expiry.

export type Grant = typeof galleryAccessGrant.$inferSelect;

export function generateShareToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url"); // 256-bit
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function isGrantActive(grant: Grant): boolean {
  if (grant.revokedAt) return false;
  if (grant.expiresAt && grant.expiresAt.getTime() <= Date.now()) return false;
  return true;
}

/** Resolve a raw share token to an ACTIVE grant, or null. Constant-time lookup. */
export async function resolveGrant(rawToken: string): Promise<Grant | null> {
  if (!rawToken) return null;
  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select()
    .from(galleryAccessGrant)
    .where(eq(galleryAccessGrant.tokenHash, tokenHash))
    .limit(1);
  const grant = rows[0];
  if (!grant) return null;
  return isGrantActive(grant) ? grant : null;
}
