import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, parseJson, problem } from "@/src/lib/http";
import { resolveEmailProvider } from "@/src/email";
import { getSiteSettingsRow } from "@/src/db/queries/settings";
import { contactNotification } from "@/src/email/templates";
import { getEnv } from "@/src/lib/env";
import { normalizeNotificationConfig } from "@/src/lib/notification-settings";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ to: z.string().email().optional() });

// POST — send a sample contact inquiry using the saved contact email template.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, BodySchema);
  if ("error" in parsed) return parsed.error;
  const to = parsed.data.to ?? a.session.user.email;
  if (!to) {
    return problem(422, "NO_RECIPIENT", "No recipient address available.");
  }

  const env = getEnv();
  const row = await getSiteSettingsRow();
  const notificationConfig = normalizeNotificationConfig(row?.notificationConfig);

  try {
    const provider = await resolveEmailProvider();
    await provider.send(
      contactNotification({
        to,
        name: "Sample Client",
        email: "client@example.com",
        phone: "555-0100",
        subject: "Portrait session inquiry",
        message:
          "Hi, I would like to ask about availability for a portrait session next month.",
        submittedAt: new Date(),
        adminUrl: new URL("/admin/contact", env.APP_BASE_URL).toString(),
        subjectTemplate: notificationConfig.contactEmailSubjectTemplate,
        bodyTemplate: notificationConfig.contactEmailBodyTemplate,
      }),
    );
    return ok({ sent: true, to });
  } catch (err) {
    return problem(
      502,
      "EMAIL_SEND_FAILED",
      err instanceof Error ? err.message : "Failed to send test contact email.",
    );
  }
}
