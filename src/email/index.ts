import { getEnv } from "@/src/lib/env";
import type { EmailProvider } from "@/src/email/provider";
import { LogEmailProvider } from "@/src/email/drivers/log";
import { SmtpEmailProvider } from "@/src/email/drivers/smtp";
import { ResendEmailProvider } from "@/src/email/drivers/resend";

export type { EmailProvider, EmailMessage } from "@/src/email/provider";

let provider: EmailProvider | null = null;

// Driver selection with safe fallback: if the configured driver lacks its
// credentials, fall back to the log driver rather than silently failing sends.
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
