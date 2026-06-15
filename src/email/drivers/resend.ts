import { getEnv } from "@/src/lib/env";
import type { EmailMessage, EmailProvider } from "@/src/email/provider";

// Resend driver via the HTTP API (no SDK dependency). Selected with
// EMAIL_DRIVER=resend + RESEND_API_KEY.
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;
  private from: string;

  constructor() {
    const env = getEnv();
    this.apiKey = env.RESEND_API_KEY ?? "";
    this.from = env.EMAIL_FROM;
  }

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
    }
  }
}
