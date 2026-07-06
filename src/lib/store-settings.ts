export type StoreShippingMode = "manual" | "free" | "flat";
export type StoreShippingProfileMode = StoreShippingMode | "pickup";
export type StorePaymentProvider = "manual" | "stripe";
export type StorePaymentMode = "test" | "live";
export type StorePromoDiscountType = "percent" | "fixed";

export interface StoreShippingProfile {
  id: string;
  label: string;
  mode: StoreShippingProfileMode;
  amountCents: number;
  freeThresholdCents: number;
  enabled: boolean;
}

export interface StorePromoCode {
  id: string;
  code: string;
  label: string;
  active: boolean;
  discountType: StorePromoDiscountType;
  amountCents: number;
  percentBps: number;
  minimumSubtotalCents: number;
  usageLimit: number | null;
  expiresAt: string | null;
}

export interface StorePromoApplication {
  code: string;
  label: string;
  discountType: StorePromoDiscountType;
  discountCents: number;
}

export interface ResolvedStoreShippingProfile {
  id: string;
  label: string;
  mode: StoreShippingProfileMode;
  amountCents: number;
  freeThresholdCents: number;
  shippingCents: number;
  isFallback: boolean;
}

export interface StoreCheckoutSettings {
  notifyEmail: string | null;
  checkoutLabel: string;
  checkoutInstructions: string;
  confirmationMessage: string;
  taxEnabled: boolean;
  taxRateBps: number;
  shippingMode: StoreShippingMode;
  shippingFlatCents: number;
  shippingProfiles: StoreShippingProfile[];
  promoCodes: StorePromoCode[];
}

export interface StorePaymentSettings {
  onlinePaymentsEnabled: boolean;
  paymentProvider: StorePaymentProvider;
  paymentMode: StorePaymentMode;
  stripeTaxEnabled: boolean;
  stripeShippingTaxCode: string | null;
  stripePublishableKey: string | null;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
  stripeStatementDescriptor: string | null;
}

export interface StorePaymentStatus {
  activeCheckoutPath: "manual" | "hosted";
  readyForHostedCheckout: boolean;
  missing: string[];
  label: string;
}

export interface StoreTotals {
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  shippingProfile: ResolvedStoreShippingProfile;
  promo: StorePromoApplication | null;
  promoError: string | null;
}

export type PublicStoreCheckoutSettings = Omit<
  StoreCheckoutSettings,
  "notifyEmail" | "promoCodes"
>;

export const STORE_CHECKOUT_DEFAULTS: StoreCheckoutSettings = {
  notifyEmail: null,
  checkoutLabel: "Manual invoice checkout",
  checkoutInstructions:
    "Submit your details and a pending order will be saved for manual follow-up.",
  confirmationMessage:
    "Your request has been saved for manual review. The studio will follow up with invoice, payment, or fulfillment details.",
  taxEnabled: false,
  taxRateBps: 0,
  shippingMode: "manual",
  shippingFlatCents: 0,
  shippingProfiles: [],
  promoCodes: [],
};

export const STORE_PAYMENT_DEFAULTS: StorePaymentSettings = {
  onlinePaymentsEnabled: false,
  paymentProvider: "manual",
  paymentMode: "test",
  stripeTaxEnabled: false,
  stripeShippingTaxCode: null,
  stripePublishableKey: null,
  stripeSecretKeySet: false,
  stripeWebhookSecretSet: false,
  stripeStatementDescriptor: null,
};

export function normalizeTaxRateBps(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.round(parsed), 0), 10000);
}

export function normalizeMoneyCents(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(Math.round(parsed), 0), 100_000_000);
}

function normalizeNullablePositiveInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.floor(parsed), 1), 1_000_000);
}

function normalizeId(value: unknown, fallback: string) {
  const cleaned =
    typeof value === "string"
      ? value
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";
  return cleaned || fallback;
}

export function normalizeShippingMode(value: unknown): StoreShippingMode {
  return value === "free" || value === "flat" || value === "manual"
    ? value
    : STORE_CHECKOUT_DEFAULTS.shippingMode;
}

export function normalizeShippingProfileMode(
  value: unknown,
): StoreShippingProfileMode {
  return value === "pickup" ? "pickup" : normalizeShippingMode(value);
}

export function normalizePromoDiscountType(value: unknown): StorePromoDiscountType {
  return value === "fixed" ? "fixed" : "percent";
}

export function normalizePromoCodeInput(value: unknown) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, "");
  return cleaned ? cleaned.slice(0, 40) : null;
}

function promoExpiresAt(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999Z`);
  }
  return new Date(value);
}

export function normalizePaymentProvider(value: unknown): StorePaymentProvider {
  return value === "stripe" || value === "manual"
    ? value
    : STORE_PAYMENT_DEFAULTS.paymentProvider;
}

export function normalizePaymentMode(value: unknown): StorePaymentMode {
  return value === "live" || value === "test"
    ? value
    : STORE_PAYMENT_DEFAULTS.paymentMode;
}

export function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeStripeTaxCode(value: unknown) {
  const cleaned = normalizeOptionalText(value);
  return cleaned ? cleaned.slice(0, 80) : null;
}

export function normalizeShippingProfiles(
  value: unknown,
): StoreShippingProfile[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value.slice(0, 12).map((item, index) => {
    const record =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    let id = normalizeId(record.id, `shipping-${index + 1}`);
    if (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    const label =
      typeof record.label === "string" && record.label.trim()
        ? record.label.trim().slice(0, 80)
        : `Shipping option ${index + 1}`;
    return {
      id,
      label,
      mode: normalizeShippingProfileMode(record.mode),
      amountCents: normalizeMoneyCents(record.amountCents),
      freeThresholdCents: normalizeMoneyCents(record.freeThresholdCents),
      enabled: record.enabled !== false,
    };
  });
}

export function normalizePromoCodes(value: unknown): StorePromoCode[] {
  if (!Array.isArray(value)) return [];
  const usedCodes = new Set<string>();
  return value
    .slice(0, 50)
    .map((item, index) => {
      const record =
        item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const code = normalizePromoCodeInput(record.code);
      if (!code || usedCodes.has(code)) return null;
      usedCodes.add(code);
      const id = normalizeId(record.id, `promo-${index + 1}`);
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label.trim().slice(0, 100)
          : code;
      return {
        id,
        code,
        label,
        active: record.active !== false,
        discountType: normalizePromoDiscountType(record.discountType),
        amountCents: normalizeMoneyCents(record.amountCents),
        percentBps: normalizeTaxRateBps(record.percentBps),
        minimumSubtotalCents: normalizeMoneyCents(record.minimumSubtotalCents),
        usageLimit: normalizeNullablePositiveInteger(record.usageLimit),
        expiresAt: normalizeOptionalText(record.expiresAt),
      };
    })
    .filter((item): item is StorePromoCode => Boolean(item));
}

export function normalizeStoreCheckoutSettings(
  input: Partial<StoreCheckoutSettings> = {},
): StoreCheckoutSettings {
  return {
    notifyEmail: normalizeOptionalText(input.notifyEmail),
    checkoutLabel:
      typeof input.checkoutLabel === "string" && input.checkoutLabel.trim()
        ? input.checkoutLabel.trim()
        : STORE_CHECKOUT_DEFAULTS.checkoutLabel,
    checkoutInstructions:
      normalizeOptionalText(input.checkoutInstructions) ??
      STORE_CHECKOUT_DEFAULTS.checkoutInstructions,
    confirmationMessage:
      normalizeOptionalText(input.confirmationMessage) ??
      STORE_CHECKOUT_DEFAULTS.confirmationMessage,
    taxEnabled: Boolean(input.taxEnabled),
    taxRateBps: normalizeTaxRateBps(input.taxRateBps),
    shippingMode: normalizeShippingMode(input.shippingMode),
    shippingFlatCents: normalizeMoneyCents(input.shippingFlatCents),
    shippingProfiles: normalizeShippingProfiles(input.shippingProfiles),
    promoCodes: normalizePromoCodes(input.promoCodes),
  };
}

export function normalizeStorePaymentSettings(
  input: Partial<StorePaymentSettings> = {},
): StorePaymentSettings {
  const paymentProvider = normalizePaymentProvider(input.paymentProvider);
  const stripeStatementDescriptor = normalizeOptionalText(
    input.stripeStatementDescriptor,
  );

  return {
    onlinePaymentsEnabled:
      paymentProvider === "stripe" ? Boolean(input.onlinePaymentsEnabled) : false,
    paymentProvider,
    paymentMode: normalizePaymentMode(input.paymentMode),
    stripeTaxEnabled:
      paymentProvider === "stripe" ? Boolean(input.stripeTaxEnabled) : false,
    stripeShippingTaxCode:
      paymentProvider === "stripe"
        ? normalizeStripeTaxCode(input.stripeShippingTaxCode)
        : null,
    stripePublishableKey: normalizeOptionalText(input.stripePublishableKey),
    stripeSecretKeySet: Boolean(input.stripeSecretKeySet),
    stripeWebhookSecretSet: Boolean(input.stripeWebhookSecretSet),
    stripeStatementDescriptor: stripeStatementDescriptor
      ? stripeStatementDescriptor.slice(0, 22)
      : null,
  };
}

export function storePaymentStatus(settings: StorePaymentSettings): StorePaymentStatus {
  const normalized = normalizeStorePaymentSettings(settings);
  const missing: string[] = [];

  if (normalized.paymentProvider !== "stripe") {
    return {
      activeCheckoutPath: "manual",
      readyForHostedCheckout: false,
      missing,
      label: "Manual invoice checkout",
    };
  }

  if (!normalized.onlinePaymentsEnabled) missing.push("online payment readiness");
  if (!normalized.stripePublishableKey) missing.push("Stripe publishable key");
  if (!normalized.stripeSecretKeySet) missing.push("Stripe secret key");
  if (!normalized.stripeWebhookSecretSet) missing.push("Stripe webhook secret");

  return {
    activeCheckoutPath: missing.length === 0 ? "hosted" : "manual",
    readyForHostedCheckout: missing.length === 0,
    missing,
    label:
      missing.length === 0 ? "Stripe settings ready" : "Stripe settings incomplete",
  };
}

function legacyShippingProfile(settings: StoreCheckoutSettings): StoreShippingProfile {
  return {
    id: "default",
    label:
      settings.shippingMode === "flat"
        ? "Standard shipping"
        : settings.shippingMode === "free"
          ? "Free shipping"
          : "Quote after review",
    mode: settings.shippingMode,
    amountCents: settings.shippingFlatCents,
    freeThresholdCents: 0,
    enabled: true,
  };
}

export function publicShippingProfiles(
  settings: StoreCheckoutSettings,
): StoreShippingProfile[] {
  const profiles = settings.shippingProfiles.filter((profile) => profile.enabled);
  return profiles.length > 0 ? profiles : [legacyShippingProfile(settings)];
}

export function resolveStoreShippingProfile(
  subtotalCents: number,
  settings: StoreCheckoutSettings,
  shippingProfileId?: string | null,
): ResolvedStoreShippingProfile {
  const profiles = publicShippingProfiles(settings);
  const selected =
    profiles.find((profile) => profile.id === shippingProfileId) ?? profiles[0];
  const subtotal = normalizeMoneyCents(subtotalCents);
  const threshold = normalizeMoneyCents(selected.freeThresholdCents);
  const shippingCents =
    selected.mode === "flat" && subtotal > 0
      ? threshold > 0 && subtotal >= threshold
        ? 0
        : normalizeMoneyCents(selected.amountCents)
      : 0;
  return {
    id: selected.id,
    label: selected.label,
    mode: selected.mode,
    amountCents: selected.amountCents,
    freeThresholdCents: selected.freeThresholdCents,
    shippingCents,
    isFallback: settings.shippingProfiles.length === 0,
  };
}

export function applyStorePromoCode(
  subtotalCents: number,
  settings: StoreCheckoutSettings,
  codeInput?: string | null,
  opts: { usageCount?: number; now?: Date } = {},
): {
  discountCents: number;
  promo: StorePromoApplication | null;
  promoError: string | null;
} {
  const subtotal = normalizeMoneyCents(subtotalCents);
  const code = normalizePromoCodeInput(codeInput);
  if (!code) return { discountCents: 0, promo: null, promoError: null };
  if (subtotal <= 0) {
    return {
      discountCents: 0,
      promo: null,
      promoError: "Add an item before using a promo code.",
    };
  }

  const promo = settings.promoCodes.find((item) => item.code === code);
  if (!promo) {
    return { discountCents: 0, promo: null, promoError: "Promo code not found." };
  }
  if (!promo.active) {
    return {
      discountCents: 0,
      promo: null,
      promoError: "Promo code is no longer active.",
    };
  }
  if (promo.expiresAt) {
    const expiresAt = promoExpiresAt(promo.expiresAt);
    if (Number.isFinite(expiresAt.getTime()) && expiresAt < (opts.now ?? new Date())) {
      return { discountCents: 0, promo: null, promoError: "Promo code has expired." };
    }
  }
  if (promo.minimumSubtotalCents > 0 && subtotal < promo.minimumSubtotalCents) {
    return {
      discountCents: 0,
      promo: null,
      promoError: `Promo code requires a subtotal of at least ${new Intl.NumberFormat(
        "en-US",
        { style: "currency", currency: "USD" },
      ).format(promo.minimumSubtotalCents / 100)}.`,
    };
  }
  if (promo.usageLimit !== null && (opts.usageCount ?? 0) >= promo.usageLimit) {
    return {
      discountCents: 0,
      promo: null,
      promoError: "Promo code has reached its usage limit.",
    };
  }

  const discountCents =
    promo.discountType === "fixed"
      ? Math.min(subtotal, promo.amountCents)
      : Math.min(subtotal, Math.round((subtotal * promo.percentBps) / 10000));
  if (discountCents <= 0) {
    return {
      discountCents: 0,
      promo: null,
      promoError: "Promo code is not configured with a discount yet.",
    };
  }

  return {
    discountCents,
    promo: {
      code: promo.code,
      label: promo.label,
      discountType: promo.discountType,
      discountCents,
    },
    promoError: null,
  };
}

export function calculateStoreTotals(
  subtotalCents: number,
  settings: StoreCheckoutSettings,
  opts: {
    shippingProfileId?: string | null;
    promoCode?: string | null;
    promoUsageCount?: number;
    now?: Date;
  } = {},
): StoreTotals {
  const subtotal = normalizeMoneyCents(subtotalCents);
  const promoResult = applyStorePromoCode(subtotal, settings, opts.promoCode, {
    usageCount: opts.promoUsageCount,
    now: opts.now,
  });
  const discountedSubtotal = Math.max(0, subtotal - promoResult.discountCents);
  const shippingProfile = resolveStoreShippingProfile(
    discountedSubtotal,
    settings,
    opts.shippingProfileId,
  );
  const taxCents =
    discountedSubtotal > 0 && settings.taxEnabled
      ? Math.round((discountedSubtotal * settings.taxRateBps) / 10000)
      : 0;
  return {
    discountCents: promoResult.discountCents,
    taxCents,
    shippingCents: shippingProfile.shippingCents,
    totalCents: discountedSubtotal + taxCents + shippingProfile.shippingCents,
    shippingProfile,
    promo: promoResult.promo,
    promoError: promoResult.promoError,
  };
}

export function publicStoreCheckoutSettings(
  settings: StoreCheckoutSettings,
): PublicStoreCheckoutSettings {
  const {
    notifyEmail: _notifyEmail,
    promoCodes: _promoCodes,
    ...publicSettings
  } = settings;
  return {
    ...publicSettings,
    shippingProfiles: publicShippingProfiles(settings),
  };
}
