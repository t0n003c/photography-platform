// EmailProvider seam (SMTP + Resend drivers). Wired in Phase 6 for the contact
// form, client-gallery invites, and future invoices.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
