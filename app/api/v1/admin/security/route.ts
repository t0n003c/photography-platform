import { desc } from "drizzle-orm";
import { requireRole } from "@/src/auth/session";
import { ok } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { contactSubmission, securityEvent } from "@/src/db/schema";
import { parseUserAgent } from "@/src/lib/security-event-utils";

export const dynamic = "force-dynamic";

const CONTACT_LIMIT = 300;
const EVENT_LIMIT = 750;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function iso(value: Date): string {
  return value.toISOString();
}

function countryFromSignals(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const country = value.country;
  return typeof country === "string" && country.length === 2 ? country : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type IpStats = {
  ipAddress: string;
  total: number;
  contact: number;
  login: number;
  traffic: number;
  country: string | null;
  latestAt: string | null;
};

function touchIp(
  stats: Map<string, IpStats>,
  ipAddress: string | null,
  surface: "contact" | "login" | "traffic",
  country: string | null,
  createdAt: string,
) {
  if (!ipAddress) return;
  const current =
    stats.get(ipAddress) ??
    ({
      ipAddress,
      total: 0,
      contact: 0,
      login: 0,
      traffic: 0,
      country: null,
      latestAt: null,
    } satisfies IpStats);
  current.total += 1;
  current[surface] += 1;
  current.country = country ?? current.country;
  if (!current.latestAt || createdAt > current.latestAt) current.latestAt = createdAt;
  stats.set(ipAddress, current);
}

// GET /api/v1/admin/security - Security & Spam dashboard data.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const [contacts, events] = await Promise.all([
    db
      .select({
        id: contactSubmission.id,
        name: contactSubmission.name,
        email: contactSubmission.email,
        subject: contactSubmission.subject,
        spamScore: contactSubmission.spamScore,
        spamVerdict: contactSubmission.spamVerdict,
        spamSignals: contactSubmission.spamSignals,
        status: contactSubmission.status,
        ipAddress: contactSubmission.ipAddress,
        userAgent: contactSubmission.userAgent,
        createdAt: contactSubmission.createdAt,
      })
      .from(contactSubmission)
      .orderBy(desc(contactSubmission.createdAt), desc(contactSubmission.id))
      .limit(CONTACT_LIMIT),
    db
      .select({
        id: securityEvent.id,
        surface: securityEvent.surface,
        action: securityEvent.action,
        outcome: securityEvent.outcome,
        ipAddress: securityEvent.ipAddress,
        country: securityEvent.country,
        userAgent: securityEvent.userAgent,
        browser: securityEvent.browser,
        os: securityEvent.os,
        device: securityEvent.device,
        referrer: securityEvent.referrer,
        source: securityEvent.source,
        path: securityEvent.path,
        email: securityEvent.email,
        metadata: securityEvent.metadata,
        createdAt: securityEvent.createdAt,
      })
      .from(securityEvent)
      .orderBy(desc(securityEvent.createdAt), desc(securityEvent.id))
      .limit(EVENT_LIMIT),
  ]);

  const ipStats = new Map<string, IpStats>();
  const contactIpCounts = new Map<string, number>();

  for (const row of contacts) {
    if (row.ipAddress) {
      contactIpCounts.set(row.ipAddress, (contactIpCounts.get(row.ipAddress) ?? 0) + 1);
    }
  }

  const contactRows = contacts.map((row) => {
    const parsedUa = parseUserAgent(row.userAgent);
    const createdAt = iso(row.createdAt);
    const country = countryFromSignals(row.spamSignals);
    touchIp(ipStats, row.ipAddress, "contact", country, createdAt);
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      spamScore: row.spamScore,
      spamVerdict: row.spamVerdict,
      status: row.status,
      ipAddress: row.ipAddress,
      ipFrequency: row.ipAddress ? (contactIpCounts.get(row.ipAddress) ?? 1) : 0,
      country,
      userAgent: row.userAgent,
      browser: parsedUa.browser,
      os: parsedUa.os,
      device: parsedUa.device,
      spamSignals: row.spamSignals,
      createdAt,
    };
  });

  const eventRows = events.map((row) => {
    const createdAt = iso(row.createdAt);
    touchIp(ipStats, row.ipAddress, row.surface, row.country, createdAt);
    return {
      id: row.id,
      surface: row.surface,
      action: row.action,
      outcome: row.outcome,
      ipAddress: row.ipAddress,
      country: row.country,
      userAgent: row.userAgent,
      browser: row.browser,
      os: row.os,
      device: row.device,
      referrer: row.referrer,
      source: row.source,
      path: row.path,
      email: row.email,
      metadata: row.metadata,
      createdAt,
    };
  });

  const loginEvents = eventRows.filter((row) => row.surface === "login");
  const trafficEvents = eventRows.filter((row) => row.surface === "traffic");

  const sources = new Map<
    string,
    {
      source: string;
      count: number;
      latestAt: string | null;
      latestPath: string | null;
      mobile: number;
      desktop: number;
      tablet: number;
    }
  >();

  for (const row of trafficEvents) {
    const source = row.source ?? "Direct";
    const current =
      sources.get(source) ??
      ({
        source,
        count: 0,
        latestAt: null,
        latestPath: null,
        mobile: 0,
        desktop: 0,
        tablet: 0,
      } satisfies {
        source: string;
        count: number;
        latestAt: string | null;
        latestPath: string | null;
        mobile: number;
        desktop: number;
        tablet: number;
      });
    current.count += 1;
    if (row.device === "Mobile") current.mobile += 1;
    else if (row.device === "Tablet") current.tablet += 1;
    else current.desktop += 1;
    if (!current.latestAt || row.createdAt > current.latestAt) {
      current.latestAt = row.createdAt;
      current.latestPath = row.path;
    }
    sources.set(source, current);
  }

  const trafficSources = Array.from(sources.values()).sort(
    (a, b) => b.count - a.count || (b.latestAt ?? "").localeCompare(a.latestAt ?? ""),
  );
  const topIps = Array.from(ipStats.values())
    .sort(
      (a, b) => b.total - a.total || (b.latestAt ?? "").localeCompare(a.latestAt ?? ""),
    )
    .slice(0, 25);

  const contactSpam = contactRows.filter(
    (row) => row.spamVerdict === "spam" || row.status === "spam",
  ).length;
  const loginFailed = loginEvents.filter((row) =>
    ["failed", "blocked"].includes(row.outcome),
  ).length;
  const loginBlocked = loginEvents.filter((row) => row.outcome === "blocked").length;

  return ok({
    generatedAt: new Date().toISOString(),
    summary: {
      contactTotal: contactRows.length,
      contactSpam,
      loginTotal: loginEvents.length,
      loginFailed,
      loginBlocked,
      trafficTotal: trafficEvents.length,
      uniqueIps: ipStats.size,
      topSource: stringValue(trafficSources[0]?.source) ?? "No data",
      topIp: topIps[0]?.ipAddress ?? "No data",
    },
    contacts: contactRows.slice(0, 75),
    loginEvents: loginEvents.slice(0, 100),
    trafficSources: trafficSources.slice(0, 20),
    recentTraffic: trafficEvents.slice(0, 100),
    topIps,
    recentEvents: eventRows.slice(0, 125),
  });
}
