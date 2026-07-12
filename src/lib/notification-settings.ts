import { z } from "zod";

export interface NotificationConfig {
  pushEnabled: boolean;
  contactSubmissions: boolean;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  pushEnabled: false,
  contactSubmissions: true,
};

export const NotificationConfigInputSchema = z.object({
  pushEnabled: z.boolean().optional(),
  contactSubmissions: z.boolean().optional(),
});

export function normalizeNotificationConfig(input: unknown): NotificationConfig {
  const parsed = NotificationConfigInputSchema.safeParse(input ?? {});
  const value = parsed.success ? parsed.data : {};
  return {
    pushEnabled: value.pushEnabled ?? DEFAULT_NOTIFICATION_CONFIG.pushEnabled,
    contactSubmissions:
      value.contactSubmissions ?? DEFAULT_NOTIFICATION_CONFIG.contactSubmissions,
  };
}
