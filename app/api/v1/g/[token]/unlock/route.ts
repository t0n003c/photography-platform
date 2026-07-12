import { z } from "zod";
import { loadClientGalleryAccess } from "@/src/auth/client-gallery-access";
import { cookieName, issueGallerySession } from "@/src/auth/gallery-session";
import { verifyPassword } from "@/src/lib/password";
import { ok, problem, tooMany, parseJson, forbidden } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { clientIp } from "@/src/lib/request";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ password: z.string().min(1) });

const SESSION_TTL = 3600;

// POST /api/v1/g/:token/unlock — exchange a gallery/grant password for a
// short-lived session cookie. Generic errors so we never reveal which token
// exists or why a password failed (SECURITY.md §7).
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

  // Rate-limit token RESOLUTION (per IP) before any DB lookup, so token
  // probing is throttled even on misses (SECURITY.md §3.1).
  const ip = clientIp(req);
  const ipRl = await rateLimit(`gunlock-ip:${ip}`, 30, 900);
  if (!ipRl.ok) return tooMany(ipRl.retryAfter);

  const resolved = await loadClientGalleryAccess(token);
  if ("res" in resolved) return resolved.res;
  const { grant, passwordHash } = resolved.access;
  if (!grant.canView) return forbidden();

  const rl = await rateLimit(`gunlock:${grant.id}:${ip}`, 10, 900);
  if (!rl.ok) return tooMany(rl.retryAfter);

  const parsed = await parseJson(req, bodySchema);
  if ("error" in parsed) return parsed.error;
  const { password } = parsed.data;

  // No password set anywhere — nothing to unlock.
  if (!passwordHash) return ok({ unlocked: true });

  const valid = await verifyPassword(password, passwordHash);
  if (!valid) {
    return problem(401, "INVALID_PASSWORD", "Unable to unlock this gallery.");
  }

  const session = issueGallerySession(grant.id, SESSION_TTL);
  const res = ok({ unlocked: true });
  res.cookies.set({
    name: cookieName(grant.id),
    value: session,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}
