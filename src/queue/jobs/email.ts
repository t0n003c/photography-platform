import type { EmailMessage } from "@/src/email/provider";

// Shared email job contract (producer: API routes; consumer: worker).
export const EMAIL_QUEUE = "email" as const;

export interface SendEmailJob {
  message: EmailMessage;
}
