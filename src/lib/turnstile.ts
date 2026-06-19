import { getEnv } from "@/src/lib/env";

// Cloudflare Turnstile server-side verification (bot protection at login).
// Keys live in env (localhost uses Cloudflare's always-pass TEST keys). The
// admin toggles enforcement in Settings; the toggle only takes effect when keys
// are configured.
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** True when both Turnstile keys are present in the environment. */
export function captchaConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
}

/** The public site key, or null if not configured. */
export function turnstileSiteKey(): string | null {
  return getEnv().TURNSTILE_SITE_KEY ?? null;
}

/** Verify a Turnstile token. Returns true if not configured (so it never locks
 *  you out when keys are missing). */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string,
): Promise<boolean> {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → don't block
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);
    const res = await fetch(SITEVERIFY, { method: "POST", body: form });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
