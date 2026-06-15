import { z } from "zod";
import { accepted, tooMany, parseJson } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { clientIp, userAgent } from "@/src/lib/request";
import { newId } from "@/src/lib/id";
import { db } from "@/src/db/client";
import { contactSubmission } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  subject: z.string().optional(),
  message: z.string().min(1),
  phone: z.string().optional(),
  company: z.string().optional(), // honeypot — bots fill hidden fields
  _ts: z.number().optional(), // form-render timestamp for too-fast detection
  captchaToken: z.string().optional(),
});

// POST /api/v1/contact — public, spam-protected contact form.
export async function POST(req: Request) {
  const ip = clientIp(req);

  // Two-tier rate limit: 3/hour AND 10/day. Throttle on either.
  const hourly = await rateLimit(`contact:${ip}`, 3, 3600);
  if (!hourly.ok) return tooMany(hourly.retryAfter);
  const daily = await rateLimit(`contact:${ip}`, 10, 86400);
  if (!daily.ok) return tooMany(daily.retryAfter);

  const parsed = await parseJson(req, contactSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const honeypot = !!(body.company && body.company.trim().length > 0);
  const tooFast = body._ts !== undefined && Date.now() - body._ts < 3000;
  const flagged = honeypot || tooFast;

  await db.insert(contactSubmission).values({
    id: newId(),
    name: body.name,
    email: body.email,
    phone: body.phone ?? null,
    subject: body.subject ?? null,
    message: body.message,
    spamScore: flagged ? 1.0 : 0.0,
    spamVerdict: flagged ? "spam" : "ham",
    spamSignals: { honeypot, tooFast },
    status: flagged ? "spam" : "new",
    ipAddress: ip,
    userAgent: userAgent(req) ?? null,
  });

  // NOTE: notification email send is deferred to Phase 6.

  // Always return success so bots can't distinguish spam detection.
  return accepted({ received: true });
}
