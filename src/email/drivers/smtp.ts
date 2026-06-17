import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "@/src/lib/env";
import type { EmailMessage, EmailProvider } from "@/src/email/provider";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from: string;
}

// SMTP driver (nodemailer). Config is passed in (resolved from DB settings or
// env by the caller). Falls back to env when constructed with no argument.
export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor(config?: SmtpConfig) {
    const cfg = config ?? SmtpEmailProvider.fromEnv();
    this.from = cfg.from;
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure ?? cfg.port === 465,
      auth: cfg.user && cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }

  static fromEnv(): SmtpConfig {
    const env = getEnv();
    return {
      host: env.SMTP_HOST ?? "localhost",
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
      from: env.EMAIL_FROM,
    };
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
