// Request context helpers. Behind Cloudflare Tunnel + NPM we trust the
// edge-provided client IP only (SECURITY.md §3.1) — never raw X-Forwarded-For
// from arbitrary clients beyond the first hop.
export function clientIp(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  // Only trust X-Forwarded-For OUTSIDE production. In production the edge
  // (Cloudflare Tunnel) sets cf-connecting-ip; trusting arbitrary XFF would let
  // a client forge the rate-limit/lockout/audit identity (SECURITY.md §3.1).
  if (process.env.NODE_ENV !== "production") {
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
  }
  return "0.0.0.0";
}

export function userAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") ?? undefined;
}

export function clientCountry(req: Request): string | null {
  const raw =
    req.headers.get("cf-ipcountry") ??
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("x-country-code");
  const country = raw?.trim().toUpperCase();
  if (!country || country === "XX" || country === "T1") return null;
  return /^[A-Z]{2}$/.test(country) ? country : null;
}
