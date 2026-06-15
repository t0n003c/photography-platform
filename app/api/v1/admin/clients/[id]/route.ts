import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireRole, requireFreshAuth } from "@/src/auth/session";
import { ok, noContent, notFound, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { client } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

async function loadClient(id: string) {
  const rows = await db
    .select()
    .from(client)
    .where(and(eq(client.id, id), isNull(client.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// GET — client detail.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;
  const row = await loadClient(id);
  if (!row) return notFound();
  return ok(row);
}

// PATCH — update a client.
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireRole("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const current = await loadClient(id);
  if (!current) return notFound();

  const updates: Partial<typeof client.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.notes !== undefined) updates.notes = body.notes;

  await db.update(client).set(updates).where(eq(client.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "client.update",
    entityType: "client",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id });
}

// DELETE — soft delete (step-up required).
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const a = await requireFreshAuth("admin");
  if (a.error) return a.error;
  const { id } = await ctx.params;

  const current = await loadClient(id);
  if (!current) return notFound();

  await db.update(client).set({ deletedAt: new Date() }).where(eq(client.id, id));

  await writeAudit({
    actorId: a.session.user.id,
    action: "client.delete",
    entityType: "client",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return noContent();
}
