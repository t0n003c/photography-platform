// Opaque keyset/cursor pagination helpers (API-DESIGN §3.1). Cursors encode the
// last row's sort key(s) so the next page is an index range scan, stable under
// inserts. Default limit 50, max 200.

export function clampLimit(raw: string | null, def = 50, max = 200): number {
  const n = raw ? Number.parseInt(raw, 10) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T = Record<string, unknown>>(
  raw: string | null,
): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
