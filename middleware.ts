import { NextResponse, type NextRequest } from "next/server";

// Global security headers + nonce-based CSP (SECURITY.md §5). CSP ships in
// Report-Only first (per §5.2) so the WebGL/PWA work in later phases can be
// validated before enforcing. Baseline headers are enforced now.
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const isProd = process.env.NODE_ENV === "production";

  const csp = [
    "default-src 'self'",
    // Next dev needs eval; prod is nonce-only.
    `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`,
    // Styles use 'unsafe-inline' (NOT a nonce): a nonce would make the browser
    // ignore 'unsafe-inline' and block React/Tailwind inline styles. Style-based
    // XSS is low-risk; scripts remain strict nonce-only.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    // 'self' (not 'none') so the admin Design editor can embed public pages in
    // its live-preview iframe. Still blocks cross-origin clickjacking.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
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

  const res = NextResponse.next({ request: { headers: requestHeaders } });

  // ── Caching (CACHING-STRATEGY.md) ──────────────────────────────────────────
  // Private surfaces must never be cached at shared layers; public read APIs are
  // CDN-cacheable with stale-while-revalidate. The media route sets its own
  // (immutable vs no-store) and is left alone.
  const path = request.nextUrl.pathname;
  const isPrivate =
    path.startsWith("/admin") ||
    path.startsWith("/login") ||
    path.startsWith("/g/") ||
    path.startsWith("/api/v1/admin") ||
    path.startsWith("/api/v1/g") ||
    path.startsWith("/api/auth");
  if (isPrivate) {
    res.headers.set("Cache-Control", "private, no-store");
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
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (isProd) {
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
