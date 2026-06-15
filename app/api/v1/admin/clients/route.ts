import { z } from "zod";
import { desc, isNull } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { created, ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { client } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// GET — list non-deleted clients, createdAt desc.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const rows = await db
    .select()
    .from(client)
    .where(isNull(client.deletedAt))
    .orderBy(desc(client.createdAt));

  return ok({ data: rows });
}

// POST — create a client.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, CreateSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const id = newId();
  await db.insert(client).values({
    id,
    name: body.name ?? null,
    email: body.email,
    phone: body.phone ?? null,
    notes: body.notes ?? null,
    createdBy: a.session.user.id,
  });

  await writeAudit({
    actorId: a.session.user.id,
    action: "client.create",
    entityType: "client",
    entityId: id,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { email: body.email },
  });

  return created({ id });
}
