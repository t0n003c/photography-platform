import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { contactSubmission } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["new", "read", "replied", "archived", "spam"]),
});

// PATCH /api/v1/admin/contact/{id} — update triage status.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const { id } = await ctx.params;
  const parsed = await parseJson(req, patchSchema);
  if ("error" in parsed) return parsed.error;

  const existing = await db
    .select()
    .from(contactSubmission)
    .where(eq(contactSubmission.id, id))
    .limit(1);
  if (!existing[0]) return notFound();

  await db
    .update(contactSubmission)
    .set({ status: parsed.data.status, handledBy: a.session.user.id })
    .where(eq(contactSubmission.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "contact.update",
    entityType: "contact_submission",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { status: parsed.data.status },
  });

  return ok({ contact: { id, status: parsed.data.status } });
}
