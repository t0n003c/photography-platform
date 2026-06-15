import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { photo } from "@/src/db/schema";
import { isPhotoPublic, serializePhotos } from "@/src/db/queries/photos";
import { ok, notFound } from "@/src/lib/http";

export const dynamic = "force-dynamic";

// Public detail for a single photo (only if reachable on a public surface).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rows = await db.select().from(photo).where(eq(photo.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) return notFound();
  if (!(await isPhotoPublic(row.id))) return notFound();

  const [dto] = await serializePhotos([row]);
  if (!dto) return notFound();
  return ok(dto);
}
