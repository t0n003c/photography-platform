import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import * as webPush from "web-push";
import { db } from "@/src/db/client";
import { pushSubscription, user as userTable } from "@/src/db/schema";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { getEnv } from "@/src/lib/env";
import { normalizeNotificationConfig } from "@/src/lib/notification-settings";

export interface PushNotificationPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let configuredFingerprint: string | null = null;

function getWebPushConfig(): WebPushConfig | null {
  const env = getEnv();
  const publicKey = env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    subject: env.WEB_PUSH_SUBJECT?.trim() || env.APP_BASE_URL,
  };
}

function ensureWebPushConfigured(): WebPushConfig | null {
  const config = getWebPushConfig();
  if (!config) return null;
  const fingerprint = `${config.subject}:${config.publicKey}:${config.privateKey}`;
  if (configuredFingerprint !== fingerprint) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredFingerprint = fingerprint;
  }
  return config;
}

export function webPushStatus() {
  const config = getWebPushConfig();
  return {
    configured: Boolean(config),
    publicKey: config?.publicKey ?? null,
  };
}

export function pushEndpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function rowToPushSubscription(
  row: typeof pushSubscription.$inferSelect,
): webPush.PushSubscription {
  return {
    endpoint: row.endpoint,
    expirationTime: row.expirationTime?.getTime() ?? null,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function topicFor(tag: string | undefined): string | undefined {
  const topic = tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return topic || undefined;
}

function errorSummary(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 500);
  return "Unknown Web Push error";
}

async function sendPushToRow(
  row: typeof pushSubscription.$inferSelect,
  payload: PushNotificationPayload,
): Promise<boolean> {
  if (!ensureWebPushConfigured() || !row.enabled) return false;

  try {
    await webPush.sendNotification(
      rowToPushSubscription(row),
      JSON.stringify(payload),
      {
        TTL: 60 * 60,
        urgency: "high",
        timeout: 5000,
        topic: topicFor(payload.tag),
      },
    );
    await db
      .update(pushSubscription)
      .set({
        lastSentAt: new Date(),
        failedAt: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(pushSubscription.id, row.id));
    return true;
  } catch (err) {
    const statusCode = err instanceof webPush.WebPushError ? err.statusCode : undefined;
    const expired = statusCode === 404 || statusCode === 410;
    await db
      .update(pushSubscription)
      .set({
        enabled: expired ? false : row.enabled,
        failedAt: new Date(),
        failureReason: errorSummary(err),
        updatedAt: new Date(),
      })
      .where(eq(pushSubscription.id, row.id));
    console.error("[web-push] failed to send notification", err);
    return false;
  }
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushNotificationPayload,
  opts: { endpoint?: string } = {},
): Promise<{ attempted: number; sent: number }> {
  const conditions = [
    eq(pushSubscription.userId, userId),
    eq(pushSubscription.enabled, true),
  ];
  if (opts.endpoint) {
    conditions.push(eq(pushSubscription.endpointHash, pushEndpointHash(opts.endpoint)));
  }

  const rows = await db
    .select()
    .from(pushSubscription)
    .where(and(...conditions));
  const sent = (
    await Promise.all(rows.map((row) => sendPushToRow(row, payload)))
  ).filter(Boolean).length;
  return { attempted: rows.length, sent };
}

export async function notifyContactSubmissionPush(opts: {
  submissionId: string;
  name: string;
  subject?: string | null;
}): Promise<void> {
  try {
    if (!webPushStatus().configured) return;
    const settings = await getSiteSettingsRow();
    const config = normalizeNotificationConfig(settings?.notificationConfig);
    if (!config.pushEnabled || !config.contactSubmissions) return;

    const rows = await db
      .select({ subscription: pushSubscription })
      .from(pushSubscription)
      .innerJoin(userTable, eq(pushSubscription.userId, userTable.id))
      .where(
        and(
          eq(pushSubscription.enabled, true),
          inArray(userTable.role, ["owner", "admin"]),
        ),
      );
    const subject = opts.subject?.trim();
    await Promise.all(
      rows.map(({ subscription }) =>
        sendPushToRow(subscription, {
          title: "New contact inquiry",
          body: subject
            ? `${opts.name}: ${subject}`
            : `${opts.name} sent a new message`,
          tag: `contact-${opts.submissionId}`,
          url: "/admin/contact",
          icon: "/icon.svg",
          badge: "/icon.svg",
        }),
      ),
    );
  } catch (err) {
    console.error("[web-push] failed to notify contact submission", err);
  }
}
