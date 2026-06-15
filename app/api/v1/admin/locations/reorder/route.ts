import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { location } from "@/src/db/schema";
import { invalidate, CACHE_KEYS } from "@/src/lib/cache";

export const dynamic = "force-dynamic";

const Body = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number().int() })).min(1),
});

// PATCH — set the display order of locations.
export async function PATCH(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;

  await db.transaction(async (tx) => {
    for (const it of parsed.data.items) {
      await tx
        .update(location)
        .set({ sortOrder: it.sortOrder })
        .where(eq(location.id, it.id));
    }
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "location.reorder",
    entityType: "location",
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { count: parsed.data.items.length },
  });
  await invalidate(CACHE_KEYS.locations);
  return ok({ reordered: parsed.data.items.length });
}
