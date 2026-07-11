import { NextResponse, type NextRequest } from "next/server";

// Global security headers + nonce-based CSP (SECURITY.md §5). CSP ships in
// Report-Only first (per §5.2) so the WebGL/PWA work in later phases can be
// validated before enforcing. Baseline headers are enforced now.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isProd = process.env.NODE_ENV === "production";
  // Effective scheme: honor a reverse proxy's X-Forwarded-Proto, else the
  // request's own protocol. `upgrade-insecure-requests`/HSTS only make sense
  // (and only work) over HTTPS — sending them on a plain-HTTP deployment (e.g. a
  // NAS at http://ip:port) makes the browser try to load every asset over HTTPS
  // and fail with ERR_SSL_PROTOCOL_ERROR.
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  const isHttps = proto === "https";

  // Cloudflare Turnstile (login bot-protection widget) loads a script + iframe
  // from this origin and posts to it; allow it in the relevant directives.
  const turnstile = "https://challenges.cloudflare.com";
  // Location map blocks use OpenFreeMap vector styles/tiles. OpenFreeMap is
  // no-key and allows commercial use; keep CSP scoped to the tile host.
  const openFreeMap = "https://tiles.openfreemap.org";
  // Route-planning Location Map blocks can request no-key OSRM driving routes.
  const osrm = "https://router.project-osrm.org";
  const csp = [
    "default-src 'self'",
    // Next dev needs eval; prod is nonce-only. Turnstile's api.js is allowed by
    // host (nonce + host allowlist both apply without 'strict-dynamic').
    `script-src 'self' 'nonce-${nonce}' ${turnstile}${isProd ? "" : " 'unsafe-eval'"}`,
    // Styles use 'unsafe-inline' (NOT a nonce): a nonce would make the browser
    // ignore 'unsafe-inline' and block React/Tailwind inline styles. Style-based
    // XSS is low-risk; scripts remain strict nonce-only.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${openFreeMap}`,
    // Banner Prisma Hero can use an admin-provided HTTPS background video URL.
    "media-src 'self' blob: https:",
    "font-src 'self'",
    `connect-src 'self' ${turnstile} ${openFreeMap} ${osrm}`,
    `frame-src 'self' ${turnstile}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // 'self' (not 'none') so the admin Design editor can embed public pages in
    // its live-preview iframe. Still blocks cross-origin clickjacking.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    // Only force HTTPS upgrades when actually served over HTTPS.
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
    "report-uri /api/csp-report",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Setting the CSP on the REQUEST lets Next.js read the nonce and apply it to
  // its own injected <script> tags (required for enforced, nonce-based CSP).
  requestHeaders.set("content-security-policy", csp);
  // Live-design preview: force a theme when the editor passes ?__theme=.
  const previewTheme = request.nextUrl.searchParams.get("__theme");
  if (previewTheme === "light" || previewTheme === "dark") {
    requestHeaders.set("x-preview-theme", previewTheme);
  }
  if (request.nextUrl.searchParams.get("__previewFrame") === "1") {
    requestHeaders.set("x-preview-frame", "1");
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Caching (CACHING-STRATEGY.md) ──────────────────────────────────────────
  // Private surfaces must never be cached at shared layers; public read APIs are
  // CDN-cacheable with stale-while-revalidate. The media route sets its own
  // (immutable vs no-store) and is left alone.
  const path = request.nextUrl.pathname;
  const isPublicRuntimeConfig =
    path === "/api/v1/auth-config" || path === "/api/v1/contact-config";
  const isPrivate =
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.startsWith("/g/") ||
    path.startsWith("/api/v1/admin") ||
    path.startsWith("/api/v1/g") ||
    path.startsWith("/api/auth");
  if (isPrivate) {
    res.headers.set("Cache-Control", "private, no-store");
  } else if (isPublicRuntimeConfig) {
    res.headers.set("Cache-Control", "no-store");
  } else if (
    request.method === "GET" &&
    path.startsWith("/api/v1") &&
    !path.startsWith("/api/v1/media")
  ) {
    res.headers.set(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300",
    );
  }

  // Enforced (nonce-based) CSP. Violations are still reported to /api/csp-report.
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  // COOP only applies in a secure context; skip it over plain HTTP to avoid the
  // "origin untrustworthy" console noise.
  if (isHttps) {
    res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  }
  // HSTS is only honored (and only sensible) over HTTPS.
  if (isProd && isHttps) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return res;
}

export const config = {
  matcher: [
    // Everything except Next static assets + a few public files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|sw.js).*)",
  ],
};
