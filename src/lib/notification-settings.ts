import { z } from "zod";

export interface NotificationConfig {
  pushEnabled: boolean;
  contactSubmissions: boolean;
  contactEmailSubjectTemplate: string;
  contactEmailBodyTemplate: string;
}

export const DEFAULT_CONTACT_EMAIL_SUBJECT_TEMPLATE = "New inquiry{{subjectSuffix}}";

export const DEFAULT_CONTACT_EMAIL_BODY_TEMPLATE = `Name: {{name}}
Email: {{email}}
{{phoneLine}}{{subjectLine}}
Message:
{{message}}

Open in admin:
{{inboxUrl}}`;

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  pushEnabled: false,
  contactSubmissions: true,
  contactEmailSubjectTemplate: DEFAULT_CONTACT_EMAIL_SUBJECT_TEMPLATE,
  contactEmailBodyTemplate: DEFAULT_CONTACT_EMAIL_BODY_TEMPLATE,
};

export const NotificationConfigInputSchema = z.object({
  pushEnabled: z.boolean().optional(),
  contactSubmissions: z.boolean().optional(),
  contactEmailSubjectTemplate: z.string().max(240).optional(),
  contactEmailBodyTemplate: z.string().max(4000).optional(),
});

function normalizeTemplate(value: unknown, fallback: string, max: number) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

export function normalizeNotificationConfig(input: unknown): NotificationConfig {
  const parsed = NotificationConfigInputSchema.safeParse(input ?? {});
  const value = parsed.success ? parsed.data : {};
  return {
    pushEnabled: value.pushEnabled ?? DEFAULT_NOTIFICATION_CONFIG.pushEnabled,
    contactSubmissions:
      value.contactSubmissions ?? DEFAULT_NOTIFICATION_CONFIG.contactSubmissions,
    contactEmailSubjectTemplate: normalizeTemplate(
      value.contactEmailSubjectTemplate,
      DEFAULT_NOTIFICATION_CONFIG.contactEmailSubjectTemplate,
      240,
    ),
    contactEmailBodyTemplate: normalizeTemplate(
      value.contactEmailBodyTemplate,
      DEFAULT_NOTIFICATION_CONFIG.contactEmailBodyTemplate,
      4000,
    ),
  };
}
