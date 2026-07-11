import { db } from "@/src/db/client";
import { securityEvent } from "@/src/db/schema";
import { newId } from "@/src/lib/id";
import { clientCountry, clientIp, userAgent } from "@/src/lib/request";
import {
  normalizeEmailForSecurityEvent,
  normalizePathForSecurityEvent,
  parseUserAgent,
  trafficSourceFromReferrer,
} from "@/src/lib/security-event-utils";

export type SecuritySurface = "contact" | "login" | "traffic";
export type SecurityOutcome =
  | "allowed"
  | "blocked"
  | "spam"
  | "failed"
  | "success"
  | "unknown";

export interface SecurityEventEntry {
  req?: Request;
  surface: SecuritySurface;
  action: string;
  outcome?: SecurityOutcome;
  ip?: string | null;
  country?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  source?: string | null;
  path?: string | null;
  email?: string | null;
  metadata?: unknown;
}

function requestHost(req?: Request): string | null {
  if (!req) return null;
  try {
    return new URL(req.url).host;
  } catch {
    return null;
  }
}

function requestPath(req?: Request): string | null {
  if (!req) return null;
  try {
    const url = new URL(req.url);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

// Append-only event logging. It never throws into the caller's response path:
// failed telemetry should not break login, contact, or page rendering.
export async function writeSecurityEvent(entry: SecurityEventEntry): Promise<void> {
  try {
    const ua = entry.userAgent ?? (entry.req ? (userAgent(entry.req) ?? null) : null);
    const parsedUa = parseUserAgent(ua);
    const referrer = entry.referrer ?? entry.req?.headers.get("referer") ?? null;
    const host = requestHost(entry.req);

    await db.insert(securityEvent).values({
      id: newId(),
      surface: entry.surface,
      action: entry.action,
      outcome: entry.outcome ?? "unknown",
      ipAddress: entry.ip ?? (entry.req ? clientIp(entry.req) : null),
      country: entry.country ?? (entry.req ? clientCountry(entry.req) : null),
      userAgent: ua,
      browser: parsedUa.browser,
      os: parsedUa.os,
      device: parsedUa.device,
      referrer: referrer?.slice(0, 4096) ?? null,
      source: entry.source ?? trafficSourceFromReferrer(referrer, host),
      path: normalizePathForSecurityEvent(entry.path ?? requestPath(entry.req)),
      email: normalizeEmailForSecurityEvent(entry.email),
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[security-event] failed to write entry", entry.action, err);
  }
}
