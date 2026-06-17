import { getEnv } from "@/src/lib/env";
import type { EmailProvider } from "@/src/email/provider";
import { LogEmailProvider } from "@/src/email/drivers/log";
import { SmtpEmailProvider } from "@/src/email/drivers/smtp";
import { ResendEmailProvider } from "@/src/email/drivers/resend";

export type { EmailProvider, EmailMessage } from "@/src/email/provider";

let provider: EmailProvider | null = null;

// Env-only driver selection (used as the fallback when no DB settings exist).
// Safe fallback: if the configured driver lacks its credentials, use the log
// driver rather than silently failing sends.
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  const env = getEnv();
  if (env.EMAIL_DRIVER === "smtp" && env.SMTP_HOST) {
    provider = new SmtpEmailProvider();
  } else if (env.EMAIL_DRIVER === "resend" && env.RESEND_API_KEY) {
    provider = new ResendEmailProvider();
  } else {
    if (env.EMAIL_DRIVER !== "log") {
      console.warn(
        `[email] EMAIL_DRIVER=${env.EMAIL_DRIVER} but credentials missing — using log driver`,
      );
    }
    provider = new LogEmailProvider();
  }
  return provider;
}

// DB-aware resolver: prefers the SMTP/Resend config saved via the Settings UI
// (site_settings), falling back to env-based selection. Constructed per call so
// admin changes take effect without a restart. Import of the settings query is
// dynamic to keep this module usable in contexts without a DB (and avoid an
// import cycle).
export async function resolveEmailProvider(): Promise<EmailProvider> {
  try {
    const { getEmailConfig } = await import("@/src/db/queries/settings");
    const cfg = await getEmailConfig();
    if (cfg) {
      if (cfg.driver === "smtp" && cfg.smtp?.host) {
        return new SmtpEmailProvider({ ...cfg.smtp, from: cfg.from });
      }
      if (cfg.driver === "resend" && cfg.resendApiKey) {
        return new ResendEmailProvider({
          apiKey: cfg.resendApiKey,
          from: cfg.from,
        });
      }
      if (cfg.driver === "log") return new LogEmailProvider();
    }
  } catch (err) {
    console.warn("[email] could not load DB settings, using env", err);
  }
  return getEmailProvider();
}
