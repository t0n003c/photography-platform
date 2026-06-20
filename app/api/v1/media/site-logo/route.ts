import { getStorage } from "@/src/storage";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// Public: streams the uploaded site logo (used by the logo+text footer layout).
// 404s when none is set so callers can fall back to the site title text.
export async function GET() {
  const row = await getSiteSettingsRow();
  const key = row?.logoStorageKey;
  if (!key) return notFound();

  const ext = key.split(".").pop() ?? "png";
  try {
    const bytes = await getStorage().get(key);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
