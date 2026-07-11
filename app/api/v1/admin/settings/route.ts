import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, parseJson } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { db } from "@/src/db/client";
import { siteSettings } from "@/src/db/schema";
import { encryptSecret } from "@/src/lib/secrets";
import { captchaConfigured } from "@/src/lib/turnstile";
import {
  SITE_SETTINGS_ID,
  SETTINGS_DEFAULTS,
  getStorePaymentSettings,
  getSiteSettingsRow,
  invalidateSiteSettings,
} from "@/src/db/queries/settings";
import {
  normalizePromoCodes,
  normalizeShippingProfiles,
  normalizeStripeTaxCode,
  storePaymentStatus,
} from "@/src/lib/store-settings";
import {
  normalizeSecurityConfig,
  SecurityConfigInputSchema,
} from "@/src/lib/security-settings";

export const dynamic = "force-dynamic";

// GET — settings for the admin UI. Secrets are returned as booleans only.
export async function GET() {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const row = await getSiteSettingsRow();
  const paymentSettings = await getStorePaymentSettings();
  const paymentStatus = storePaymentStatus(paymentSettings);
  return ok({
    data: {
      siteTitle: row?.siteTitle ?? SETTINGS_DEFAULTS.siteTitle,
      tagline: row?.tagline ?? "",
      description: row?.description ?? SETTINGS_DEFAULTS.description,
      locale: row?.locale ?? SETTINGS_DEFAULTS.locale,
      timezone: row?.timezone ?? SETTINGS_DEFAULTS.timezone,
      dateFormat: row?.dateFormat ?? SETTINGS_DEFAULTS.dateFormat,
      weekStartsOn: row?.weekStartsOn ?? SETTINGS_DEFAULTS.weekStartsOn,
      iconStorageKey: row?.iconStorageKey ?? null,
      logoStorageKey: row?.logoStorageKey ?? null,
      emailDriver: row?.emailDriver ?? "log",
      emailFrom: row?.emailFrom ?? "",
      smtpHost: row?.smtpHost ?? "",
      smtpPort: row?.smtpPort ?? 587,
      smtpSecure: row?.smtpSecure ?? false,
      smtpUser: row?.smtpUser ?? "",
      smtpPasswordSet: Boolean(row?.smtpPasswordEnc),
      resendApiKeySet: Boolean(row?.resendApiKeyEnc),
      storeNotifyEmail: row?.storeNotifyEmail ?? "",
      storeCheckoutLabel: row?.storeCheckoutLabel ?? "Manual invoice checkout",
      storeCheckoutInstructions: row?.storeCheckoutInstructions ?? "",
      storeConfirmationMessage: row?.storeConfirmationMessage ?? "",
      storeTaxEnabled: row?.storeTaxEnabled ?? false,
      storeTaxRateBps: row?.storeTaxRateBps ?? 0,
      storeShippingMode: row?.storeShippingMode ?? "manual",
      storeShippingFlatCents: row?.storeShippingFlatCents ?? 0,
      storeShippingProfiles: normalizeShippingProfiles(row?.storeShippingProfiles),
      storePromoCodes: normalizePromoCodes(row?.storePromoCodes),
      storeOnlinePaymentsEnabled:
        paymentSettings.onlinePaymentsEnabled ??
        SETTINGS_DEFAULTS.storePayment.onlinePaymentsEnabled,
      storePaymentProvider:
        paymentSettings.paymentProvider ??
        SETTINGS_DEFAULTS.storePayment.paymentProvider,
      storePaymentMode:
        paymentSettings.paymentMode ?? SETTINGS_DEFAULTS.storePayment.paymentMode,
      storeStripeTaxEnabled:
        paymentSettings.stripeTaxEnabled ??
        SETTINGS_DEFAULTS.storePayment.stripeTaxEnabled,
      storeInvoiceTaxMode:
        paymentSettings.invoiceTaxMode ??
        SETTINGS_DEFAULTS.storePayment.invoiceTaxMode,
      storeStripeShippingTaxCode:
        paymentSettings.stripeShippingTaxCode ??
        SETTINGS_DEFAULTS.storePayment.stripeShippingTaxCode,
      stripePublishableKey: paymentSettings.stripePublishableKey ?? "",
      stripeSecretKeySet: paymentSettings.stripeSecretKeySet,
      stripeWebhookSecretSet: paymentSettings.stripeWebhookSecretSet,
      stripeStatementDescriptor: paymentSettings.stripeStatementDescriptor ?? "",
      storePaymentStatus: paymentStatus,
      igAccessTokenSet: Boolean(row?.igAccessTokenEnc),
      captchaEnabled: row?.captchaEnabled ?? false,
      captchaConfigured: captchaConfigured(),
      securityConfig: normalizeSecurityConfig(row?.securityConfig),
    },
  });
}

const PatchSchema = z.object({
  siteTitle: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  locale: z.string().min(2).max(35).optional(),
  timezone: z.string().min(1).max(64).optional(),
  dateFormat: z.enum(["short", "medium", "long", "full"]).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  emailDriver: z.enum(["log", "smtp", "resend"]).optional(),
  emailFrom: z.string().max(200).nullable().optional(),
  smtpHost: z.string().max(255).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUser: z.string().max(255).nullable().optional(),
  storeNotifyEmail: z.string().max(200).nullable().optional(),
  storeCheckoutLabel: z.string().min(1).max(80).optional(),
  storeCheckoutInstructions: z.string().max(1000).nullable().optional(),
  storeConfirmationMessage: z.string().max(1000).nullable().optional(),
  storeTaxEnabled: z.boolean().optional(),
  storeTaxRateBps: z.number().int().min(0).max(10000).optional(),
  storeShippingMode: z.enum(["manual", "free", "flat"]).optional(),
  storeShippingFlatCents: z.number().int().min(0).max(100_000_000).optional(),
  storeShippingProfiles: z
    .array(
      z.object({
        id: z.string().max(80),
        label: z.string().max(80),
        mode: z.enum(["manual", "free", "flat", "pickup"]),
        amountCents: z.number().int().min(0).max(100_000_000),
        freeThresholdCents: z.number().int().min(0).max(100_000_000),
        enabled: z.boolean(),
      }),
    )
    .max(12)
    .optional(),
  storePromoCodes: z
    .array(
      z.object({
        id: z.string().max(80),
        code: z.string().max(40),
        label: z.string().max(100),
        active: z.boolean(),
        discountType: z.enum(["percent", "fixed"]),
        amountCents: z.number().int().min(0).max(100_000_000),
        percentBps: z.number().int().min(0).max(10000),
        minimumSubtotalCents: z.number().int().min(0).max(100_000_000),
        usageLimit: z.number().int().min(1).max(1_000_000).nullable(),
        expiresAt: z.string().max(40).nullable(),
      }),
    )
    .max(50)
    .optional(),
  storeOnlinePaymentsEnabled: z.boolean().optional(),
  storePaymentProvider: z.enum(["manual", "stripe"]).optional(),
  storePaymentMode: z.enum(["test", "live"]).optional(),
  storeStripeTaxEnabled: z.boolean().optional(),
  storeInvoiceTaxMode: z.enum(["fixed", "stripe"]).optional(),
  storeStripeShippingTaxCode: z.string().max(80).nullable().optional(),
  stripePublishableKey: z.string().max(255).nullable().optional(),
  stripeStatementDescriptor: z.string().max(22).nullable().optional(),
  // Secrets: a non-empty string sets/replaces; null clears; undefined leaves.
  smtpPassword: z.string().nullable().optional(),
  resendApiKey: z.string().nullable().optional(),
  igAccessToken: z.string().nullable().optional(),
  stripeSecretKey: z.string().nullable().optional(),
  stripeWebhookSecret: z.string().nullable().optional(),
  captchaEnabled: z.boolean().optional(),
  securityConfig: SecurityConfigInputSchema.optional(),
});

// PATCH — upsert the singleton settings row. Secrets are encrypted at rest.
export async function PATCH(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const parsed = await parseJson(req, PatchSchema);
  if ("error" in parsed) return parsed.error;
  const body = parsed.data;

  const updates: Partial<typeof siteSettings.$inferInsert> = {};
  const setIf = <K extends keyof typeof body>(key: K, col: keyof typeof updates) => {
    if (body[key] !== undefined) {
      // empty string for nullable text fields becomes null
      const v = body[key];
      (updates as Record<string, unknown>)[col as string] = v === "" ? null : v;
    }
  };

  setIf("siteTitle", "siteTitle");
  setIf("tagline", "tagline");
  setIf("description", "description");
  setIf("locale", "locale");
  setIf("timezone", "timezone");
  setIf("dateFormat", "dateFormat");
  if (body.weekStartsOn !== undefined) updates.weekStartsOn = body.weekStartsOn;
  setIf("emailDriver", "emailDriver");
  setIf("emailFrom", "emailFrom");
  setIf("smtpHost", "smtpHost");
  if (body.smtpPort !== undefined) updates.smtpPort = body.smtpPort;
  if (body.smtpSecure !== undefined) updates.smtpSecure = body.smtpSecure;
  if (body.captchaEnabled !== undefined) updates.captchaEnabled = body.captchaEnabled;
  if (body.securityConfig !== undefined) {
    updates.securityConfig = normalizeSecurityConfig(body.securityConfig);
  }
  setIf("smtpUser", "smtpUser");
  setIf("storeNotifyEmail", "storeNotifyEmail");
  setIf("storeCheckoutLabel", "storeCheckoutLabel");
  setIf("storeCheckoutInstructions", "storeCheckoutInstructions");
  setIf("storeConfirmationMessage", "storeConfirmationMessage");
  if (body.storeTaxEnabled !== undefined) {
    updates.storeTaxEnabled = body.storeTaxEnabled;
  }
  if (body.storeTaxRateBps !== undefined) {
    updates.storeTaxRateBps = body.storeTaxRateBps;
  }
  setIf("storeShippingMode", "storeShippingMode");
  if (body.storeShippingFlatCents !== undefined) {
    updates.storeShippingFlatCents = body.storeShippingFlatCents;
  }
  if (body.storeShippingProfiles !== undefined) {
    updates.storeShippingProfiles = normalizeShippingProfiles(body.storeShippingProfiles);
  }
  if (body.storePromoCodes !== undefined) {
    updates.storePromoCodes = normalizePromoCodes(body.storePromoCodes);
  }
  if (body.storeOnlinePaymentsEnabled !== undefined) {
    updates.storeOnlinePaymentsEnabled = body.storeOnlinePaymentsEnabled;
  }
  setIf("storePaymentProvider", "storePaymentProvider");
  setIf("storePaymentMode", "storePaymentMode");
  if (body.storeStripeTaxEnabled !== undefined) {
    updates.storeStripeTaxEnabled = body.storeStripeTaxEnabled;
  }
  if (body.storeInvoiceTaxMode !== undefined) {
    updates.storeInvoiceTaxMode = body.storeInvoiceTaxMode;
  }
  if (body.storeStripeShippingTaxCode !== undefined) {
    updates.storeStripeShippingTaxCode = normalizeStripeTaxCode(
      body.storeStripeShippingTaxCode,
    );
  }
  setIf("stripePublishableKey", "stripePublishableKey");
  setIf("stripeStatementDescriptor", "stripeStatementDescriptor");

  if (body.smtpPassword !== undefined) {
    updates.smtpPasswordEnc = body.smtpPassword
      ? encryptSecret(body.smtpPassword)
      : null;
  }
  if (body.resendApiKey !== undefined) {
    updates.resendApiKeyEnc = body.resendApiKey
      ? encryptSecret(body.resendApiKey)
      : null;
  }
  if (body.igAccessToken !== undefined) {
    updates.igAccessTokenEnc = body.igAccessToken
      ? encryptSecret(body.igAccessToken)
      : null;
  }
  if (body.stripeSecretKey !== undefined) {
    updates.stripeSecretKeyEnc = body.stripeSecretKey
      ? encryptSecret(body.stripeSecretKey)
      : null;
  }
  if (body.stripeWebhookSecret !== undefined) {
    updates.stripeWebhookSecretEnc = body.stripeWebhookSecret
      ? encryptSecret(body.stripeWebhookSecret)
      : null;
  }

  const currentPaymentSettings = await getStorePaymentSettings();
  const nextPaymentProvider =
    updates.storePaymentProvider ?? currentPaymentSettings.paymentProvider;
  const nextStripeTaxEnabled =
    updates.storeStripeTaxEnabled ?? currentPaymentSettings.stripeTaxEnabled;

  if (updates.storePaymentProvider === "manual") {
    updates.storeOnlinePaymentsEnabled = false;
    updates.storeStripeTaxEnabled = false;
    updates.storeInvoiceTaxMode = "fixed";
    updates.storeStripeShippingTaxCode = null;
  }
  if (
    updates.storeStripeTaxEnabled === false ||
    nextPaymentProvider !== "stripe" ||
    !nextStripeTaxEnabled
  ) {
    updates.storeInvoiceTaxMode = "fixed";
  }

  await db
    .insert(siteSettings)
    .values({ id: SITE_SETTINGS_ID, ...updates })
    .onConflictDoUpdate({ target: siteSettings.id, set: updates });

  await invalidateSiteSettings();

  await writeAudit({
    actorId: a.session.user.id,
    action: "settings.update",
    entityType: "site_settings",
    entityId: SITE_SETTINGS_ID,
    ip: clientIp(req),
    userAgent: userAgent(req),
    // Never log secret values — only which keys changed.
    metadata: { fields: Object.keys(updates) },
  });

  return ok({ id: SITE_SETTINGS_ID });
}
