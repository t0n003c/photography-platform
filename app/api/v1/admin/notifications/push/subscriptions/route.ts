import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { db } from "@/src/db/client";
import { pushSubscription } from "@/src/db/schema";
import { ok, parseJson } from "@/src/lib/http";
import { newId } from "@/src/lib/id";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { pushEndpointHash } from "@/src/lib/web-push";

export const dynamic = "force-dynamic";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(4096),
    auth: z.string().min(1).max(4096),
  }),
});

const DeleteSchema = z.object({
  endpoint: z.string().url().max(4096),
});

export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, SubscriptionSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;
  const now = new Date();
  const endpointHash = pushEndpointHash(body.endpoint);

  await db
    .insert(pushSubscription)
    .values({
      id: newId(),
      userId: a.session.user.id,
      endpoint: body.endpoint,
      endpointHash,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      expirationTime: body.expirationTime ? new Date(body.expirationTime) : null,
      userAgent: userAgent(req) ?? null,
      enabled: true,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscription.endpointHash,
      set: {
        userId: a.session.user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        expirationTime: body.expirationTime ? new Date(body.expirationTime) : null,
        userAgent: userAgent(req) ?? null,
        enabled: true,
        lastSeenAt: now,
        failedAt: null,
        failureReason: null,
        updatedAt: now,
      },
    });

  await writeAudit({
    actorId: a.session.user.id,
    action: "push_subscription.upsert",
    entityType: "push_subscription",
    entityId: endpointHash,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return ok({ subscribed: true });
}

export async function DELETE(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, DeleteSchema);
  if ("error" in parsed) return parsed.error;
  const endpointHash = pushEndpointHash(parsed.data.endpoint);

  await db
    .update(pushSubscription)
    .set({
      enabled: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pushSubscription.endpointHash, endpointHash),
        eq(pushSubscription.userId, a.session.user.id),
      ),
    );

  await writeAudit({
    actorId: a.session.user.id,
    action: "push_subscription.disable",
    entityType: "push_subscription",
    entityId: endpointHash,
    ip: clientIp(req),
    userAgent: userAgent(req),
  });

  return ok({ subscribed: false });
}
