import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { siteSettings } from "@/src/db/schema";
import { cached, invalidate } from "@/src/lib/cache";
import { decryptSecret } from "@/src/lib/secrets";
import {
  normalizeStoreCheckoutSettings,
  STORE_CHECKOUT_DEFAULTS,
  type StoreCheckoutSettings,
} from "@/src/lib/store-settings";

export const SITE_SETTINGS_ID = "site";
const CACHE_KEY = "pub:site_settings";

// Built-in defaults, used before a row exists and as fallbacks.
export const SETTINGS_DEFAULTS = {
  siteTitle: "Photography Platform",
  tagline: null as string | null,
  description:
    "A self-hosted photography studio — fine-art portfolios, private client galleries, and museum-quality prints.",
  locale: "en",
  timezone: "UTC",
  dateFormat: "medium" as "short" | "medium" | "long" | "full",
  weekStartsOn: 0,
  iconStorageKey: null as string | null,
  logoStorageKey: null as string | null,
  storeCheckout: STORE_CHECKOUT_DEFAULTS,
};

export type SiteSettingsRow = typeof siteSettings.$inferSelect;

/** Raw row (incl. secret ciphertext). Server-only; never send to the client.
 *  Resilient: returns null if the DB is unreachable (e.g. during `next build`),
 *  so callers degrade to defaults rather than failing the build. */
export async function getSiteSettingsRow(): Promise<SiteSettingsRow | null> {
  try {
    const rows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, SITE_SETTINGS_ID))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export interface PublicSiteSettings {
  siteTitle: string;
  tagline: string | null;
  description: string | null;
  locale: string;
  timezone: string;
  dateFormat: "short" | "medium" | "long" | "full";
  weekStartsOn: number;
  iconStorageKey: string | null;
  logoStorageKey: string | null;
}

// Cached, sanitized settings for rendering (no secrets). Safe to put in Redis.
export async function getSiteSettings(): Promise<PublicSiteSettings> {
  return cached<PublicSiteSettings>(CACHE_KEY, 300, async () => {
    const row = await getSiteSettingsRow();
    return {
      siteTitle: row?.siteTitle ?? SETTINGS_DEFAULTS.siteTitle,
      tagline: row?.tagline ?? SETTINGS_DEFAULTS.tagline,
      description: row?.description ?? SETTINGS_DEFAULTS.description,
      locale: row?.locale ?? SETTINGS_DEFAULTS.locale,
      timezone: row?.timezone ?? SETTINGS_DEFAULTS.timezone,
      dateFormat: row?.dateFormat ?? SETTINGS_DEFAULTS.dateFormat,
      weekStartsOn: row?.weekStartsOn ?? SETTINGS_DEFAULTS.weekStartsOn,
      iconStorageKey: row?.iconStorageKey ?? SETTINGS_DEFAULTS.iconStorageKey,
      logoStorageKey: row?.logoStorageKey ?? SETTINGS_DEFAULTS.logoStorageKey,
    };
  });
}

/** {name, description} for SEO/OG, derived from settings. */
export async function getSiteMeta(): Promise<{ name: string; description: string }> {
  const s = await getSiteSettings();
  return {
    name: s.siteTitle,
    description: s.description ?? SETTINGS_DEFAULTS.description!,
  };
}

export interface ResolvedEmailConfig {
  driver: "log" | "smtp" | "resend";
  from: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
  resendApiKey?: string;
}

// Email transport config from the DB, with secrets decrypted. Read directly
// (not via the Redis cache) so plaintext secrets never touch Redis. Returns
// null when no row exists (caller falls back to env-based config).
export async function getEmailConfig(): Promise<ResolvedEmailConfig | null> {
  const row = await getSiteSettingsRow();
  if (!row) return null;
  return {
    driver: row.emailDriver,
    from: row.emailFrom ?? "Studio <hello@example.com>",
    smtp: row.smtpHost
      ? {
          host: row.smtpHost,
          port: row.smtpPort,
          secure: row.smtpSecure,
          user: row.smtpUser ?? undefined,
          pass: decryptSecret(row.smtpPasswordEnc) ?? undefined,
        }
      : undefined,
    resendApiKey: decryptSecret(row.resendApiKeyEnc) ?? undefined,
  };
}

export async function getStoreCheckoutSettings(): Promise<StoreCheckoutSettings> {
  const row = await getSiteSettingsRow();
  return normalizeStoreCheckoutSettings({
    notifyEmail: row?.storeNotifyEmail ?? SETTINGS_DEFAULTS.storeCheckout.notifyEmail,
    checkoutLabel:
      row?.storeCheckoutLabel ?? SETTINGS_DEFAULTS.storeCheckout.checkoutLabel,
    checkoutInstructions:
      row?.storeCheckoutInstructions ??
      SETTINGS_DEFAULTS.storeCheckout.checkoutInstructions,
    confirmationMessage:
      row?.storeConfirmationMessage ??
      SETTINGS_DEFAULTS.storeCheckout.confirmationMessage,
    taxEnabled: row?.storeTaxEnabled ?? SETTINGS_DEFAULTS.storeCheckout.taxEnabled,
    taxRateBps: row?.storeTaxRateBps ?? SETTINGS_DEFAULTS.storeCheckout.taxRateBps,
    shippingMode:
      row?.storeShippingMode ?? SETTINGS_DEFAULTS.storeCheckout.shippingMode,
    shippingFlatCents:
      row?.storeShippingFlatCents ?? SETTINGS_DEFAULTS.storeCheckout.shippingFlatCents,
  });
}

// Instagram Graph API token (decrypted), or null. Read directly (not cached)
// so the plaintext never touches Redis.
export async function getInstagramToken(): Promise<string | null> {
  const row = await getSiteSettingsRow();
  return decryptSecret(row?.igAccessTokenEnc);
}

export async function invalidateSiteSettings(): Promise<void> {
  await invalidate(CACHE_KEY);
}
