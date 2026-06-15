import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { notFound } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { gallery } from "@/src/db/schema";
import { getStorage } from "@/src/storage";

export const dynamic = "force-dynamic";

// GET — stream the rendered slideshow MP4 (admin).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ key: gallery.videoStorageKey, slug: gallery.slug })
    .from(gallery)
    .where(eq(gallery.id, id))
    .limit(1);
  const g = rows[0];
  if (!g?.key) return notFound();

  const bytes = await getStorage().get(g.key);
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${g.slug}-slideshow.mp4"`,
      "Cache-Control": "private, no-store",
    },
  });
}
