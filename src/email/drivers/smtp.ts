import type { EmailMessage, EmailProvider } from "@/src/email/provider";

// STUB — real SMTP transport (nodemailer) is added in Phase 6.
export class SmtpEmailProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<void> {
    throw new Error("SmtpEmailProvider not implemented until Phase 6");
  }
}
