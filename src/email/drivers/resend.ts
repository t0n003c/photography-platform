import type { EmailMessage, EmailProvider } from "@/src/email/provider";

// STUB — real Resend transport is added in Phase 6.
export class ResendEmailProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<void> {
    throw new Error("ResendEmailProvider not implemented until Phase 6");
  }
}
