import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/src/lib/env";
import type { EmailMessage, EmailProvider } from "@/src/email/provider";

// SMTP driver (nodemailer). Selected with EMAIL_DRIVER=smtp + SMTP_* config.
export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const env = getEnv();
    this.from = env.EMAIL_FROM;
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASSWORD
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
    });
  }
}
