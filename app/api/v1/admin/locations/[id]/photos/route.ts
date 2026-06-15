import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { location, photoLocation } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const Body = z.object({ photoIds: z.array(z.string().min(1)).min(1) });

// POST — tag photos with a location.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const exists = await db
    .select({ id: location.id })
    .from(location)
    .where(eq(location.id, id))
    .limit(1);
  if (!exists.length) return notFound();

  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;

  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${photoLocation.sortOrder}), -1)` })
    .from(photoLocation)
    .where(eq(photoLocation.locationId, id));
  let next = (maxRow[0]?.max ?? -1) + 1;

  for (const photoId of parsed.data.photoIds) {
    await db
      .insert(photoLocation)
      .values({ locationId: id, photoId, sortOrder: next++ })
      .onConflictDoNothing();
  }

  await writeAudit({
    actorId: a.session.user.id,
    action: "location.add_photos",
    entityType: "location",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ added: parsed.data.photoIds.length });
}

// DELETE — untag photos from a location.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;

  await db
    .delete(photoLocation)
    .where(
      and(
        eq(photoLocation.locationId, id),
        inArray(photoLocation.photoId, parsed.data.photoIds),
      ),
    );

  await writeAudit({
    actorId: a.session.user.id,
    action: "location.remove_photos",
    entityType: "location",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.photoIds.length },
  });
  return ok({ removed: parsed.data.photoIds.length });
}
