import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/src/lib/env";

// Short-lived, HMAC-signed gallery session so a grant password is not re-sent on
// every request (API-DESIGN §2.2). Scoped to a single grant; stored in an
// HttpOnly cookie named `pg_<grantId>`.
function sign(payload: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function cookieName(grantId: string): string {
  return `pg_${grantId}`;
}

export function issueGallerySession(grantId: string, ttlSec = 3600): string {
  const exp = Date.now() + ttlSec * 1000;
  const payload = `${grantId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyGallerySession(
  value: string | undefined,
  grantId: string,
): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [gid, expStr, sig] = parts;
  if (gid !== grantId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Date.now()) return false;
  const expected = sign(`${gid}.${expStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
