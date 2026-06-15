import type { EmailMessage, EmailProvider } from "@/src/email/provider";

// Default driver: logs instead of sending. Keeps the platform fully functional
// (and side-effect-free) until SMTP/Resend credentials are configured.
export class LogEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email:log] to=${message.to} subject=${JSON.stringify(message.subject)}`,
    );
  }
}
