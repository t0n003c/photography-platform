// Request context helpers. Behind Cloudflare Tunnel + NPM we trust the
// edge-provided client IP only (SECURITY.md §3.1) — never raw X-Forwarded-For
// from arbitrary clients beyond the first hop.
export function clientIp(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return "0.0.0.0";
}

export function userAgent(req: Request): string | undefined {
  return req.headers.get("user-agent") ?? undefined;
}
