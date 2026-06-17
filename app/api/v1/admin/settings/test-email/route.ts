import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, parseJson, problem } from "@/src/lib/http";
import { resolveEmailProvider } from "@/src/email";
import { getSiteMeta } from "@/src/db/queries/settings";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ to: z.string().email().optional() });

// POST — send a test email using the saved email settings, synchronously, so
// the admin gets immediate success/failure feedback. Save settings first.
export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, BodySchema);
  if ("error" in parsed) return parsed.error;
  const to = parsed.data.to ?? a.session.user.email;
  if (!to) {
    return problem(422, "NO_RECIPIENT", "No recipient address available.");
  }

  const { name } = await getSiteMeta();
  try {
    const provider = await resolveEmailProvider();
    await provider.send({
      to,
      subject: `Test email from ${name}`,
      html: `<p>This is a test email from <strong>${name}</strong>. If you received it, your email settings are working.</p>`,
      text: `This is a test email from ${name}. If you received it, your email settings are working.`,
    });
    return ok({ sent: true, to });
  } catch (err) {
    return problem(
      502,
      "EMAIL_SEND_FAILED",
      err instanceof Error ? err.message : "Failed to send test email.",
    );
  }
}
