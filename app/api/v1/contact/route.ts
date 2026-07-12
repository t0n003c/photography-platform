import { z } from "zod";
import { accepted, forbidden, tooMany, parseJson } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { clientCountry, clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { getEnv } from "@/src/lib/env";
import { db } from "@/src/db/client";
import { contactSubmission } from "@/src/db/schema";
import { enqueueEmail } from "@/src/email/send";
import { contactNotification } from "@/src/email/templates";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { captchaConfigured, verifyTurnstile } from "@/src/lib/turnstile";
import { writeSecurityEvent } from "@/src/lib/security-events";
import {
  countLinks,
  isBlockedEmailDomain,
  isBlockedIp,
  matchingKeywords,
  normalizeSecurityConfig,
} from "@/src/lib/security-settings";
import { normalizeNotificationConfig } from "@/src/lib/notification-settings";
import { notifyContactSubmissionPush } from "@/src/lib/web-push";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().max(180).optional(),
  message: z.string().trim().min(1).max(5000),
  phone: z.string().trim().max(80).optional(),
  company: z.string().trim().max(200).optional(), // honeypot — bots fill hidden fields
  _ts: z.number().optional(), // form-render timestamp for too-fast detection
  captchaToken: z.string().max(4096).optional(),
});

// POST /api/v1/contact — public, spam-protected contact form.
export async function POST(req: Request) {
  const ip = clientIp(req);
  const country = clientCountry(req);
  const settings = await getSiteSettingsRow();
  const security = normalizeSecurityConfig(settings?.securityConfig);
  const notifications = normalizeNotificationConfig(settings?.notificationConfig);

  if (isBlockedIp(ip, security.blockedIps)) {
    await writeSecurityEvent({
      req,
      surface: "contact",
      action: "contact.blocked",
      outcome: "blocked",
      ip,
      country,
      metadata: { reason: "ip_block" },
    });
    return forbidden("Request blocked.");
  }
  if (country && security.blockedCountries.includes(country)) {
    await writeSecurityEvent({
      req,
      surface: "contact",
      action: "contact.blocked",
      outcome: "blocked",
      ip,
      country,
      metadata: { reason: "country_block" },
    });
    return forbidden("Request blocked.");
  }

  // Two-tier rate limit: hourly AND daily. Distinct keys so each window's
  // counter + TTL are independent.
  const hourly = await rateLimit(`contact:h:${ip}`, security.contactHourlyLimit, 3600);
  if (!hourly.ok) {
    await writeSecurityEvent({
      req,
      surface: "contact",
      action: "contact.rate_limited",
      outcome: "blocked",
      ip,
      country,
      metadata: { window: "hourly", retryAfter: hourly.retryAfter },
    });
    return tooMany(hourly.retryAfter);
  }
  const daily = await rateLimit(`contact:d:${ip}`, security.contactDailyLimit, 86400);
  if (!daily.ok) {
    await writeSecurityEvent({
      req,
      surface: "contact",
      action: "contact.rate_limited",
      outcome: "blocked",
      ip,
      country,
      metadata: { window: "daily", retryAfter: daily.retryAfter },
    });
    return tooMany(daily.retryAfter);
  }

  const parsed = await parseJson(req, contactSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const honeypot = !!body.company;
  const tooFast =
    body._ts !== undefined && Date.now() - body._ts < security.contactMinSubmitMs;
  const captchaRequired = security.contactCaptchaEnabled && captchaConfigured();
  const captchaFailed =
    captchaRequired && !(await verifyTurnstile(body.captchaToken, ip));
  const linkCount = countLinks(`${body.subject ?? ""}\n${body.message}`);
  const tooManyLinks =
    security.contactMaxLinks > 0 && linkCount > security.contactMaxLinks;
  const emailDomainBlocked = isBlockedEmailDomain(
    body.email,
    security.blockedEmailDomains,
  );
  const keywordMatches = matchingKeywords(
    [body.name, body.email, body.subject ?? "", body.message].join("\n"),
    security.blockedKeywords,
  );
  const spamFlags = [
    honeypot,
    tooFast,
    captchaFailed,
    tooManyLinks,
    emailDomainBlocked,
    keywordMatches.length > 0,
  ];
  const flagged = spamFlags.some(Boolean);
  const spamScore = flagged ? Math.min(1, spamFlags.filter(Boolean).length / 3) : 0;

  const submissionId = newId();
  await db.insert(contactSubmission).values({
    id: submissionId,
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    subject: body.subject ?? null,
    message: body.message,
    spamScore,
    spamVerdict: flagged ? "spam" : "ham",
    spamSignals: {
      honeypot,
      tooFast,
      captchaRequired,
      captchaFailed,
      linkCount,
      tooManyLinks,
      emailDomainBlocked,
      keywordMatches,
      country,
    },
    status: flagged ? "spam" : "new",
    ipAddress: ip,
    userAgent: userAgent(req) ?? null,
  });

  await writeSecurityEvent({
    req,
    surface: "contact",
    action: "contact.submit",
    outcome: flagged ? "spam" : "allowed",
    ip,
    country,
    email: body.email,
    metadata: {
      submissionId,
      spamScore,
      spamVerdict: flagged ? "spam" : "ham",
      spamSignals: {
        honeypot,
        tooFast,
        captchaRequired,
        captchaFailed,
        linkCount,
        tooManyLinks,
        emailDomainBlocked,
        keywordMatches,
        country,
      },
    },
  });

  // Notify the studio for genuine (non-spam) inquiries; spam is stored silently.
  if (!flagged) {
    const env = getEnv();
    await enqueueEmail(
      contactNotification({
        to: env.CONTACT_NOTIFY_EMAIL ?? env.EMAIL_FROM,
        name: body.name,
        email: body.email,
        phone: body.phone,
        subject: body.subject,
        message: body.message,
        submittedAt: new Date(),
        adminUrl: new URL("/admin/contact", env.APP_BASE_URL).toString(),
        subjectTemplate: notifications.contactEmailSubjectTemplate,
        bodyTemplate: notifications.contactEmailBodyTemplate,
      }),
    );
    await notifyContactSubmissionPush({
      submissionId,
      name: body.name,
      subject: body.subject,
    });
  }

  // Always return success so bots can't distinguish spam detection.
  return accepted({ received: true });
}
