export type StoreShippingMode = "manual" | "free" | "flat";
export type StorePaymentProvider = "manual" | "stripe";
export type StorePaymentMode = "test" | "live";

export interface StoreCheckoutSettings {
  notifyEmail: string | null;
  checkoutLabel: string;
  checkoutInstructions: string;
  confirmationMessage: string;
  taxEnabled: boolean;
  taxRateBps: number;
  shippingMode: StoreShippingMode;
  shippingFlatCents: number;
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
  taxCents: number;
  shippingCents: number;
  totalCents: number;
}

export type PublicStoreCheckoutSettings = Omit<StoreCheckoutSettings, "notifyEmail">;

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

export function normalizeShippingMode(value: unknown): StoreShippingMode {
  return value === "free" || value === "flat" || value === "manual"
    ? value
    : STORE_CHECKOUT_DEFAULTS.shippingMode;
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

export function calculateStoreTotals(
  subtotalCents: number,
  settings: StoreCheckoutSettings,
): StoreTotals {
  const subtotal = normalizeMoneyCents(subtotalCents);
  const taxCents =
    subtotal > 0 && settings.taxEnabled
      ? Math.round((subtotal * settings.taxRateBps) / 10000)
      : 0;
  const shippingCents =
    subtotal > 0 && settings.shippingMode === "flat" ? settings.shippingFlatCents : 0;
  return {
    taxCents,
    shippingCents,
    totalCents: subtotal + taxCents + shippingCents,
  };
}

export function publicStoreCheckoutSettings(
  settings: StoreCheckoutSettings,
): PublicStoreCheckoutSettings {
  const { notifyEmail: _notifyEmail, ...publicSettings } = settings;
  return publicSettings;
}
