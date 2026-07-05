export type StoreShippingMode = "manual" | "free" | "flat";

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

export function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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
