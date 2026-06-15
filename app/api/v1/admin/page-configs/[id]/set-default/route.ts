import { eq } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok, notFound } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { pageConfig } from "@/src/db/schema";

export const dynamic = "force-dynamic";

// POST — make this config the default for its scope.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const rows = await db
    .select({ id: pageConfig.id, scope: pageConfig.scope })
    .from(pageConfig)
    .where(eq(pageConfig.id, id))
    .limit(1);
  const current = rows[0];
  if (!current) return notFound();

  await db.transaction(async (tx) => {
    await tx
      .update(pageConfig)
      .set({ isDefault: false })
      .where(eq(pageConfig.scope, current.scope));
    await tx
      .update(pageConfig)
      .set({ isDefault: true })
      .where(eq(pageConfig.id, id));
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "pageconfig.set_default",
    entityType: "page_config",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { scope: current.scope },
  });

  return ok({ id, scope: current.scope, isDefault: true });
}
