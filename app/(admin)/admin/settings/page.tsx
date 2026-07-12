"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BellOff,
  BellRing,
  ChevronDown,
  Loader2,
  Plus,
  Smartphone,
  Trash2,
  Upload as UploadIcon,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";
import type { StorePromoCode, StoreShippingProfile } from "@/src/lib/store-settings";

interface SettingsDTO {
  siteTitle: string;
  tagline: string;
  description: string;
  locale: string;
  timezone: string;
  dateFormat: "short" | "medium" | "long" | "full";
  weekStartsOn: number;
  iconStorageKey: string | null;
  logoStorageKey: string | null;
  emailDriver: "log" | "smtp" | "resend";
  emailFrom: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordSet: boolean;
  resendApiKeySet: boolean;
  storeNotifyEmail: string;
  storeCheckoutLabel: string;
  storeCheckoutInstructions: string;
  storeConfirmationMessage: string;
  storeTaxEnabled: boolean;
  storeTaxRateBps: number;
  storeShippingMode: "manual" | "free" | "flat";
  storeShippingFlatCents: number;
  storeShippingProfiles: StoreShippingProfile[];
  storePromoCodes: StorePromoCode[];
  storeOnlinePaymentsEnabled: boolean;
  storePaymentProvider: "manual" | "stripe";
  storePaymentMode: "test" | "live";
  storeStripeTaxEnabled: boolean;
  storeInvoiceTaxMode: "fixed" | "stripe";
  storeStripeShippingTaxCode: string | null;
  stripePublishableKey: string;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
  stripeStatementDescriptor: string;
  storePaymentStatus: {
    activeCheckoutPath: "manual" | "hosted";
    readyForHostedCheckout: boolean;
    missing: string[];
    label: string;
  };
  igAccessTokenSet: boolean;
  pushNotificationsEnabled: boolean;
  pushContactNotificationsEnabled: boolean;
  webPushConfigured: boolean;
  webPushPublicKey: string | null;
}

type PushDeviceStatus =
  | "checking"
  | "unsupported"
  | "permission-denied"
  | "subscribed"
  | "unsubscribed";

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

const LOCALES = [
  "en",
  "en-US",
  "en-GB",
  "fr",
  "fr-FR",
  "de",
  "es",
  "es-ES",
  "it",
  "pt",
  "pt-BR",
  "nl",
  "ja",
  "ko",
  "zh",
  "zh-CN",
  "vi",
  "ru",
];

function centsToAmount(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

function amountToCents(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function bpsToPercent(bps: number) {
  return (Math.max(0, bps) / 100).toString();
}

function percentToBps(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(Math.max(Math.round(parsed * 100), 0), 10000)
    : 0;
}

function profileId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function newShippingProfile(): StoreShippingProfile {
  return {
    id: profileId("ship"),
    label: "Standard shipping",
    mode: "flat",
    amountCents: 0,
    freeThresholdCents: 0,
    enabled: true,
  };
}

function newPromoCode(): StorePromoCode {
  return {
    id: profileId("promo"),
    code: "NEWCODE",
    label: "New promo",
    active: true,
    discountType: "percent",
    amountCents: 0,
    percentBps: 1000,
    minimumSubtotalCents: 0,
    usageLimit: null,
    expiresAt: null,
  };
}

function normalizeCodeInput(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);
}

function pushDeviceStatusLabel(status: PushDeviceStatus) {
  switch (status) {
    case "checking":
      return "Checking this device";
    case "unsupported":
      return "Not supported on this browser";
    case "permission-denied":
      return "Blocked by browser permission";
    case "subscribed":
      return "Enabled on this device";
    case "unsubscribed":
      return "Not enabled on this device";
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function paymentStatusFor(settings: {
  paymentProvider: SettingsDTO["storePaymentProvider"];
  onlinePaymentsEnabled: boolean;
  stripePublishableKey: string;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
}) {
  if (settings.paymentProvider !== "stripe") {
    return {
      activeCheckoutPath: "manual" as const,
      readyForHostedCheckout: false,
      missing: [],
      label: "Manual invoice checkout",
    };
  }

  const missing: string[] = [];
  if (!settings.onlinePaymentsEnabled) missing.push("online payment readiness");
  if (!settings.stripePublishableKey?.trim()) missing.push("Stripe publishable key");
  if (!settings.stripeSecretKeySet) missing.push("Stripe secret key");
  if (!settings.stripeWebhookSecretSet) missing.push("Stripe webhook secret");

  return {
    activeCheckoutPath:
      missing.length === 0 ? ("hosted" as const) : ("manual" as const),
    readyForHostedCheckout: missing.length === 0,
    missing,
    label:
      missing.length === 0 ? "Stripe settings ready" : "Stripe settings incomplete",
  };
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 639px)").matches;
  });

  return (
    <Card>
      <CardHeader className="gap-0">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              open ? "" : "-rotate-90"
            }`}
            aria-hidden="true"
          />
          <CardTitle>{title}</CardTitle>
        </button>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}

function useTimezones(): string[] {
  return useMemo(() => {
    try {
      // Supported in modern browsers; fall back to a short common list.
      const fn = (
        Intl as unknown as {
          supportedValuesOf?: (k: string) => string[];
        }
      ).supportedValuesOf;
      if (fn) return fn("timeZone");
    } catch {
      /* ignore */
    }
    return [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Tokyo",
      "Asia/Shanghai",
      "Asia/Ho_Chi_Minh",
      "Australia/Sydney",
    ];
  }, []);
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [s, setS] = useState<SettingsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [igAccessToken, setIgAccessToken] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushDeviceStatus, setPushDeviceStatus] =
    useState<PushDeviceStatus>("checking");
  const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
  const [iconBust, setIconBust] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timezones = useTimezones();

  const refreshPushDevice = useCallback(async (): Promise<string | null> => {
    if (typeof window === "undefined") return null;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushDeviceStatus("unsupported");
      setPushEndpoint(null);
      return null;
    }
    if (Notification.permission === "denied") {
      setPushDeviceStatus("permission-denied");
      setPushEndpoint(null);
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      setPushEndpoint(subscription?.endpoint ?? null);
      setPushDeviceStatus(subscription ? "subscribed" : "unsubscribed");
      return subscription?.endpoint ?? null;
    } catch {
      setPushEndpoint(null);
      setPushDeviceStatus("unsubscribed");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    api
      .get<{ data: SettingsDTO }>("/api/v1/admin/settings")
      .then((res) => {
        if (active) setS(res.data);
      })
      .catch((err) => {
        if (active) toast(errMsg(err), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!loading) void refreshPushDevice();
  }, [loading, refreshPushDevice]);

  const update = <K extends keyof SettingsDTO>(key: K, value: SettingsDTO[K]) =>
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));

  const updateShippingProfile = (id: string, patch: Partial<StoreShippingProfile>) =>
    setS((prev) =>
      prev
        ? {
            ...prev,
            storeShippingProfiles: prev.storeShippingProfiles.map((profile) =>
              profile.id === id ? { ...profile, ...patch } : profile,
            ),
          }
        : prev,
    );

  const updatePromoCode = (id: string, patch: Partial<StorePromoCode>) =>
    setS((prev) =>
      prev
        ? {
            ...prev,
            storePromoCodes: prev.storePromoCodes.map((promo) =>
              promo.id === id ? { ...promo, ...patch } : promo,
            ),
          }
        : prev,
    );

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        siteTitle: s.siteTitle,
        tagline: s.tagline,
        description: s.description,
        locale: s.locale,
        timezone: s.timezone,
        dateFormat: s.dateFormat,
        weekStartsOn: s.weekStartsOn,
        emailDriver: s.emailDriver,
        emailFrom: s.emailFrom,
        smtpHost: s.smtpHost,
        smtpPort: s.smtpPort,
        smtpSecure: s.smtpSecure,
        smtpUser: s.smtpUser,
        storeNotifyEmail: s.storeNotifyEmail,
        storeCheckoutLabel: s.storeCheckoutLabel,
        storeCheckoutInstructions: s.storeCheckoutInstructions,
        storeConfirmationMessage: s.storeConfirmationMessage,
        storeTaxEnabled: s.storeTaxEnabled,
        storeTaxRateBps: s.storeTaxRateBps,
        storeShippingMode: s.storeShippingMode,
        storeShippingFlatCents: s.storeShippingFlatCents,
        storeShippingProfiles: s.storeShippingProfiles,
        storePromoCodes: s.storePromoCodes,
        storeOnlinePaymentsEnabled: s.storeOnlinePaymentsEnabled,
        storePaymentProvider: s.storePaymentProvider,
        storePaymentMode: s.storePaymentMode,
        storeStripeTaxEnabled: s.storeStripeTaxEnabled,
        storeInvoiceTaxMode: s.storeInvoiceTaxMode,
        storeStripeShippingTaxCode: s.storeStripeShippingTaxCode,
        stripePublishableKey: s.stripePublishableKey,
        stripeStatementDescriptor: s.stripeStatementDescriptor,
        pushNotificationsEnabled: s.pushNotificationsEnabled,
        pushContactNotificationsEnabled: s.pushContactNotificationsEnabled,
      };
      // Secrets: only send when the admin typed a new value (write-only).
      if (smtpPassword) payload.smtpPassword = smtpPassword;
      if (resendApiKey) payload.resendApiKey = resendApiKey;
      if (igAccessToken) payload.igAccessToken = igAccessToken;
      if (stripeSecretKey) payload.stripeSecretKey = stripeSecretKey;
      if (stripeWebhookSecret) payload.stripeWebhookSecret = stripeWebhookSecret;

      await api.patch("/api/v1/admin/settings", payload);
      setSmtpPassword("");
      setResendApiKey("");
      setIgAccessToken("");
      setStripeSecretKey("");
      setStripeWebhookSecret("");
      setS((prev) =>
        prev
          ? (() => {
              const next = {
                ...prev,
                smtpPasswordSet: prev.smtpPasswordSet || Boolean(smtpPassword),
                resendApiKeySet: prev.resendApiKeySet || Boolean(resendApiKey),
                igAccessTokenSet: prev.igAccessTokenSet || Boolean(igAccessToken),
                stripeSecretKeySet: prev.stripeSecretKeySet || Boolean(stripeSecretKey),
                stripeWebhookSecretSet:
                  prev.stripeWebhookSecretSet || Boolean(stripeWebhookSecret),
              };
              return {
                ...next,
                storePaymentStatus: paymentStatusFor({
                  paymentProvider: next.storePaymentProvider,
                  onlinePaymentsEnabled: next.storeOnlinePaymentsEnabled,
                  stripePublishableKey: next.stripePublishableKey,
                  stripeSecretKeySet: next.stripeSecretKeySet,
                  stripeWebhookSecretSet: next.stripeWebhookSecretSet,
                }),
              };
            })()
          : prev,
      );
      toast("Settings saved", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadIcon = async (file: File) => {
    setUploadingIcon(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/admin/settings/icon", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(
          body?.error?.message ?? "Upload failed",
          body?.error?.code ?? "ERROR",
          res.status,
        );
      }
      update("iconStorageKey", "set");
      setIconBust((n) => n + 1);
      toast("Icon updated", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setUploadingIcon(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      // Mutations return the bare object ({ sent, to }), not a { data } envelope.
      const res = await api.post<{ sent: boolean; to: string }>(
        "/api/v1/admin/settings/test-email",
        {},
      );
      toast(`Test email sent to ${res.to}`, "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setTesting(false);
    }
  };

  const enablePush = async () => {
    if (!s) return;
    if (!s.webPushConfigured || !s.webPushPublicKey) {
      toast(
        "Web Push is not configured. Add WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY.",
        "error",
      );
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setPushDeviceStatus("unsupported");
      toast("This browser does not support PWA push notifications.", "error");
      return;
    }

    setPushBusy(true);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setPushDeviceStatus(
          permission === "denied" ? "permission-denied" : "unsubscribed",
        );
        toast("Browser notification permission was not granted.", "error");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(s.webPushPublicKey),
        }));
      await api.post("/api/v1/admin/notifications/push/subscriptions", {
        ...subscription.toJSON(),
        endpoint: subscription.endpoint,
      });
      setPushEndpoint(subscription.endpoint);
      setPushDeviceStatus("subscribed");
      toast("PWA notifications enabled on this device", "success");
    } catch (err) {
      toast(errMsg(err), "error");
      await refreshPushDevice();
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? pushEndpoint;
      if (endpoint) {
        await api.del("/api/v1/admin/notifications/push/subscriptions", {
          endpoint,
        });
      }
      if (subscription) await subscription.unsubscribe();
      setPushEndpoint(null);
      setPushDeviceStatus("unsubscribed");
      toast("PWA notifications disabled on this device", "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setPushBusy(false);
    }
  };

  const sendTestPush = async () => {
    setTestingPush(true);
    try {
      const endpoint = await refreshPushDevice();
      if (!endpoint) {
        toast("Enable this device before sending a test push.", "error");
        return;
      }
      const res = await api.post<{ attempted: number; sent: number }>(
        "/api/v1/admin/notifications/push/test",
        { endpoint },
      );
      toast(
        res.sent > 0 ? "Test push sent" : "No active subscription found",
        res.sent > 0 ? "success" : "error",
      );
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setTestingPush(false);
    }
  };

  if (loading || !s) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const paymentStatus = paymentStatusFor({
    paymentProvider: s.storePaymentProvider,
    onlinePaymentsEnabled: s.storeOnlinePaymentsEnabled,
    stripePublishableKey: s.stripePublishableKey,
    stripeSecretKeySet: s.stripeSecretKeySet,
    stripeWebhookSecretSet: s.stripeWebhookSecretSet,
  });
  const stripeSelected = s.storePaymentProvider === "stripe";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Site-wide configuration: branding, locale, and email.
        </p>
      </div>

      {/* General */}
      <SettingsSection title="General">
        <div className="space-y-4">
          <Field label="Site title">
            <Input
              value={s.siteTitle}
              onChange={(e) => update("siteTitle", e.target.value)}
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={s.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="A short line under your name"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={s.description}
              onChange={(e) => update("description", e.target.value)}
              rows={3}
              placeholder="Used for SEO and social sharing"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Language (locale)">
              <Input
                list="locale-list"
                value={s.locale}
                onChange={(e) => update("locale", e.target.value)}
              />
              <datalist id="locale-list">
                {LOCALES.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
            <Field label="Timezone">
              <Select
                value={s.timezone}
                onChange={(e) => update("timezone", e.target.value)}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date format">
              <Select
                value={s.dateFormat}
                onChange={(e) =>
                  update("dateFormat", e.target.value as SettingsDTO["dateFormat"])
                }
              >
                <option value="short">Short (e.g. 6/16/26)</option>
                <option value="medium">Medium (e.g. Jun 16, 2026)</option>
                <option value="long">Long (e.g. June 16, 2026)</option>
                <option value="full">Full (e.g. Tuesday, June 16, 2026)</option>
              </Select>
            </Field>
            <Field label="Week starts on">
              <Select
                value={String(s.weekStartsOn)}
                onChange={(e) => update("weekStartsOn", Number(e.target.value))}
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="6">Saturday</option>
              </Select>
            </Field>
          </div>
        </div>
      </SettingsSection>

      {/* Store */}
      <SettingsSection title="Store">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Checkout label">
              <Input
                value={s.storeCheckoutLabel}
                onChange={(e) => update("storeCheckoutLabel", e.target.value)}
                placeholder="Manual invoice checkout"
              />
            </Field>
            <Field label="Order notification email">
              <Input
                type="email"
                value={s.storeNotifyEmail}
                onChange={(e) => update("storeNotifyEmail", e.target.value)}
                placeholder="Leave blank to use contact email"
              />
            </Field>
          </div>
          <Field label="Checkout instructions">
            <Textarea
              value={s.storeCheckoutInstructions}
              onChange={(e) => update("storeCheckoutInstructions", e.target.value)}
              rows={3}
              placeholder="Shown above the checkout form and in the order confirmation."
            />
          </Field>
          <Field label="Confirmation message">
            <Textarea
              value={s.storeConfirmationMessage}
              onChange={(e) => update("storeConfirmationMessage", e.target.value)}
              rows={3}
              placeholder="Shown on the confirmation page and customer email."
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                checked={s.storeTaxEnabled}
                onChange={(e) => update("storeTaxEnabled", e.target.checked)}
              />
              Collect tax at checkout
            </label>
            <Field label="Tax rate (%)">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={bpsToPercent(s.storeTaxRateBps)}
                onChange={(e) =>
                  update("storeTaxRateBps", percentToBps(e.target.value))
                }
                disabled={!s.storeTaxEnabled}
              />
            </Field>
            <Field label="Shipping mode">
              <Select
                value={s.storeShippingMode}
                onChange={(e) =>
                  update(
                    "storeShippingMode",
                    e.target.value as SettingsDTO["storeShippingMode"],
                  )
                }
              >
                <option value="manual">Quote after review</option>
                <option value="free">Free shipping</option>
                <option value="flat">Flat rate</option>
              </Select>
            </Field>
            <Field label="Flat shipping amount">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={centsToAmount(s.storeShippingFlatCents)}
                onChange={(e) =>
                  update("storeShippingFlatCents", amountToCents(e.target.value))
                }
                disabled={s.storeShippingMode !== "flat"}
              />
            </Field>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Shipping profiles</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Let customers choose pickup, free, flat-rate, or quote-after-review
                  options. If no profile is active, the fallback mode above is used.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setS((prev) =>
                    prev
                      ? {
                          ...prev,
                          storeShippingProfiles: [
                            ...prev.storeShippingProfiles,
                            newShippingProfile(),
                          ],
                        }
                      : prev,
                  )
                }
              >
                <Plus className="h-4 w-4" />
                Add profile
              </Button>
            </div>

            {s.storeShippingProfiles.length === 0 ? (
              <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
                No custom profiles yet.
              </p>
            ) : (
              <div className="space-y-3">
                {s.storeShippingProfiles.map((profile) => (
                  <div key={profile.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={profile.enabled}
                          onChange={(event) =>
                            updateShippingProfile(profile.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        Active
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setS((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  storeShippingProfiles:
                                    prev.storeShippingProfiles.filter(
                                      (item) => item.id !== profile.id,
                                    ),
                                }
                              : prev,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Profile label">
                        <Input
                          value={profile.label}
                          onChange={(event) =>
                            updateShippingProfile(profile.id, {
                              label: event.target.value,
                            })
                          }
                          placeholder="Domestic shipping"
                        />
                      </Field>
                      <Field label="Profile type">
                        <Select
                          value={profile.mode}
                          onChange={(event) =>
                            updateShippingProfile(profile.id, {
                              mode: event.target.value as StoreShippingProfile["mode"],
                            })
                          }
                        >
                          <option value="flat">Flat rate</option>
                          <option value="free">Free shipping</option>
                          <option value="pickup">Local pickup</option>
                          <option value="manual">Quote after review</option>
                        </Select>
                      </Field>
                      <Field label="Shipping amount">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={centsToAmount(profile.amountCents)}
                          onChange={(event) =>
                            updateShippingProfile(profile.id, {
                              amountCents: amountToCents(event.target.value),
                            })
                          }
                          disabled={profile.mode !== "flat"}
                        />
                      </Field>
                      <Field label="Free above amount">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={centsToAmount(profile.freeThresholdCents)}
                          onChange={(event) =>
                            updateShippingProfile(profile.id, {
                              freeThresholdCents: amountToCents(event.target.value),
                            })
                          }
                          disabled={profile.mode !== "flat"}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Promo codes</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Codes apply to the full cart before tax and shipping. Usage limits are
                  counted against completed order records.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setS((prev) =>
                    prev
                      ? {
                          ...prev,
                          storePromoCodes: [...prev.storePromoCodes, newPromoCode()],
                        }
                      : prev,
                  )
                }
              >
                <Plus className="h-4 w-4" />
                Add code
              </Button>
            </div>

            {s.storePromoCodes.length === 0 ? (
              <p className="rounded-lg bg-[hsl(var(--muted))] p-3 text-xs text-[hsl(var(--muted-foreground))]">
                No promo codes yet.
              </p>
            ) : (
              <div className="space-y-3">
                {s.storePromoCodes.map((promo) => (
                  <div key={promo.id} className="rounded-lg border p-3">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={promo.active}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              active: event.target.checked,
                            })
                          }
                        />
                        Active
                      </label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setS((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  storePromoCodes: prev.storePromoCodes.filter(
                                    (item) => item.id !== promo.id,
                                  ),
                                }
                              : prev,
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Code">
                        <Input
                          value={promo.code}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              code: normalizeCodeInput(event.target.value),
                            })
                          }
                          placeholder="SUMMER10"
                        />
                      </Field>
                      <Field label="Display label">
                        <Input
                          value={promo.label}
                          onChange={(event) =>
                            updatePromoCode(promo.id, { label: event.target.value })
                          }
                          placeholder="Summer promo"
                        />
                      </Field>
                      <Field label="Discount type">
                        <Select
                          value={promo.discountType}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              discountType: event.target
                                .value as StorePromoCode["discountType"],
                            })
                          }
                        >
                          <option value="percent">Percent off</option>
                          <option value="fixed">Fixed amount off</option>
                        </Select>
                      </Field>
                      {promo.discountType === "percent" ? (
                        <Field label="Percent off">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            value={bpsToPercent(promo.percentBps)}
                            onChange={(event) =>
                              updatePromoCode(promo.id, {
                                percentBps: percentToBps(event.target.value),
                              })
                            }
                          />
                        </Field>
                      ) : (
                        <Field label="Amount off">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={centsToAmount(promo.amountCents)}
                            onChange={(event) =>
                              updatePromoCode(promo.id, {
                                amountCents: amountToCents(event.target.value),
                              })
                            }
                          />
                        </Field>
                      )}
                      <Field label="Minimum subtotal">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={centsToAmount(promo.minimumSubtotalCents)}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              minimumSubtotalCents: amountToCents(event.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Usage limit">
                        <Input
                          type="number"
                          min={1}
                          value={promo.usageLimit ?? ""}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              usageLimit:
                                event.target.value &&
                                Number.isFinite(Number(event.target.value))
                                  ? Math.max(1, Math.floor(Number(event.target.value)))
                                  : null,
                            })
                          }
                          placeholder="Unlimited"
                        />
                      </Field>
                      <Field label="Expires on">
                        <Input
                          type="date"
                          value={promo.expiresAt ?? ""}
                          onChange={(event) =>
                            updatePromoCode(promo.id, {
                              expiresAt: event.target.value || null,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Payments */}
      <SettingsSection title="Payments">
        <div className="space-y-4">
          <div className="rounded-lg border bg-[hsl(var(--muted))] p-3 text-sm">
            <p className="font-medium text-[hsl(var(--foreground))]">
              Current checkout: manual invoice requests
            </p>
            <p className="mt-1 text-[hsl(var(--muted-foreground))]">
              Enable Stripe when the account, webhook, and keys are ready. Manual
              invoice recording remains available in Store admin.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hosted payment provider">
              <Select
                value={s.storePaymentProvider}
                onChange={(e) => {
                  const provider = e.target
                    .value as SettingsDTO["storePaymentProvider"];
                  update("storePaymentProvider", provider);
                  if (provider === "manual") {
                    update("storeOnlinePaymentsEnabled", false);
                    update("storeStripeTaxEnabled", false);
                    update("storeInvoiceTaxMode", "fixed");
                    update("storeStripeShippingTaxCode", null);
                  }
                }}
              >
                <option value="manual">Manual invoices only</option>
                <option value="stripe">Stripe hosted checkout</option>
              </Select>
            </Field>
            <Field label="Stripe mode">
              <Select
                value={s.storePaymentMode}
                onChange={(e) =>
                  update(
                    "storePaymentMode",
                    e.target.value as SettingsDTO["storePaymentMode"],
                  )
                }
                disabled={!stripeSelected}
              >
                <option value="test">Test mode</option>
                <option value="live">Live mode</option>
              </Select>
            </Field>
          </div>

          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={s.storeOnlinePaymentsEnabled}
              onChange={(e) => update("storeOnlinePaymentsEnabled", e.target.checked)}
              disabled={!stripeSelected}
            />
            <span>
              <span className="block font-medium">Enable hosted Stripe checkout</span>
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                When all Stripe fields are present, public cart and invoice pages can
                send clients to Stripe Checkout.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={s.storeStripeTaxEnabled}
              onChange={(e) => {
                update("storeStripeTaxEnabled", e.target.checked);
                if (!e.target.checked) update("storeInvoiceTaxMode", "fixed");
              }}
              disabled={!stripeSelected}
            />
            <span>
              <span className="block font-medium">
                Use Stripe Tax for hosted checkout
              </span>
              <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                Stripe can calculate tax during public cart checkout and invoice payment
                links that opt into the Stripe Tax mode below. Fixed invoice links keep
                the saved tax settings above.
              </span>
            </span>
          </label>

          {stripeSelected && s.storeStripeTaxEnabled && (
            <Field
              label="Invoice payment link tax mode"
              hint="Fixed keeps issued invoice totals unchanged. Stripe Tax recalculates tax only for newly issued or intentionally refreshed invoice payment links."
            >
              <Select
                value={s.storeInvoiceTaxMode}
                onChange={(event) =>
                  update(
                    "storeInvoiceTaxMode",
                    event.target.value as SettingsDTO["storeInvoiceTaxMode"],
                  )
                }
              >
                <option value="fixed">Keep saved invoice total</option>
                <option value="stripe">Recalculate tax with Stripe Tax</option>
              </Select>
            </Field>
          )}

          {stripeSelected && s.storeStripeTaxEnabled && (
            <Field
              label="Stripe shipping tax code"
              htmlFor="store-stripe-shipping-tax-code"
              hint="Optional. Use when flat shipping should have its own Stripe Tax category."
            >
              <Input
                id="store-stripe-shipping-tax-code"
                value={s.storeStripeShippingTaxCode ?? ""}
                onChange={(e) =>
                  update("storeStripeShippingTaxCode", e.target.value || null)
                }
                placeholder="txcd_..."
                autoComplete="off"
              />
            </Field>
          )}

          {stripeSelected && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Stripe publishable key">
                <Input
                  value={s.stripePublishableKey}
                  onChange={(e) => update("stripePublishableKey", e.target.value)}
                  placeholder="pk_test_..."
                  autoComplete="off"
                />
              </Field>
              <Field label="Statement descriptor">
                <Input
                  value={s.stripeStatementDescriptor}
                  onChange={(e) =>
                    update("stripeStatementDescriptor", e.target.value.slice(0, 22))
                  }
                  placeholder="STUDIO NAME"
                  maxLength={22}
                />
              </Field>
              <Field label="Stripe secret key">
                <Input
                  type="password"
                  value={stripeSecretKey}
                  onChange={(e) => setStripeSecretKey(e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    s.stripeSecretKeySet
                      ? "•••••••• (leave blank to keep)"
                      : "sk_test_..."
                  }
                />
              </Field>
              <Field label="Stripe webhook secret">
                <Input
                  type="password"
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    s.stripeWebhookSecretSet
                      ? "•••••••• (leave blank to keep)"
                      : "whsec_..."
                  }
                />
              </Field>
            </div>
          )}

          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{paymentStatus.label}</p>
            {paymentStatus.missing.length > 0 ? (
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">
                Missing: {paymentStatus.missing.join(", ")}.
              </p>
            ) : (
              <p className="mt-1 text-[hsl(var(--muted-foreground))]">
                Hosted Stripe checkout is ready for public cart and invoice payments.
              </p>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Branding */}
      <SettingsSection title="Branding">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  s.iconStorageKey
                    ? `/api/v1/media/site-icon?v=${iconBust}`
                    : "/icon.svg"
                }
                alt="Site icon"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/icon.svg";
                }}
              />
            </div>
            <div className="space-y-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadIcon(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingIcon}
              >
                {uploadingIcon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4" />
                )}
                Upload site icon
              </Button>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                PNG, JPEG, WebP, SVG or ICO · up to 1 MB. Used as favicon and app icon.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Email */}
      <SettingsSection title="Email (SMTP)">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Driver">
              <Select
                value={s.emailDriver}
                onChange={(e) =>
                  update("emailDriver", e.target.value as SettingsDTO["emailDriver"])
                }
              >
                <option value="log">Log (no send — dev)</option>
                <option value="smtp">SMTP</option>
                <option value="resend">Resend (API)</option>
              </Select>
            </Field>
            <Field label="From address">
              <Input
                value={s.emailFrom}
                onChange={(e) => update("emailFrom", e.target.value)}
                placeholder="Studio <hello@example.com>"
              />
            </Field>
          </div>

          {s.emailDriver === "smtp" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SMTP host">
                <Input
                  value={s.smtpHost}
                  onChange={(e) => update("smtpHost", e.target.value)}
                  placeholder="smtp.mailgun.org"
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  value={s.smtpPort}
                  onChange={(e) => update("smtpPort", Number(e.target.value))}
                />
              </Field>
              <Field label="Username">
                <Input
                  value={s.smtpUser}
                  onChange={(e) => update("smtpUser", e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder={
                    s.smtpPasswordSet ? "•••••••• (leave blank to keep)" : "Not set"
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={s.smtpSecure}
                  onChange={(e) => update("smtpSecure", e.target.checked)}
                />
                Use TLS/SSL (secure connection — usually port 465)
              </label>
            </div>
          )}

          {s.emailDriver === "resend" && (
            <Field label="Resend API key">
              <Input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                autoComplete="new-password"
                placeholder={
                  s.resendApiKeySet ? "•••••••• (leave blank to keep)" : "re_..."
                }
              />
            </Field>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send test email
            </Button>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Save first — the test uses your saved settings.
            </span>
          </div>
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={s.pushNotificationsEnabled}
                onChange={(e) => update("pushNotificationsEnabled", e.target.checked)}
              />
              <span>
                <span className="block font-medium">Enable PWA push alerts</span>
                <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                  Sends browser/mobile app notifications to subscribed admin devices.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={s.pushContactNotificationsEnabled}
                disabled={!s.pushNotificationsEnabled}
                onChange={(e) =>
                  update("pushContactNotificationsEnabled", e.target.checked)
                }
              />
              <span>
                <span className="block font-medium">Contact inquiries</span>
                <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                  Notify subscribed devices when a non-spam contact form arrives.
                </span>
              </span>
            </label>
          </div>

          <div className="rounded-lg border p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">This device</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {s.webPushConfigured
                      ? "Subscribe each phone, tablet, or desktop browser separately."
                      : "Set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY to enable push."}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs ${
                  pushDeviceStatus === "subscribed"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {pushDeviceStatusLabel(pushDeviceStatus)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={enablePush}
                disabled={
                  pushBusy ||
                  !s.webPushConfigured ||
                  pushDeviceStatus === "unsupported" ||
                  pushDeviceStatus === "permission-denied"
                }
              >
                {pushBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="h-4 w-4" />
                )}
                Enable this device
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={disablePush}
                disabled={pushBusy || pushDeviceStatus !== "subscribed"}
              >
                <BellOff className="h-4 w-4" />
                Disable
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={sendTestPush}
                disabled={
                  testingPush ||
                  !s.webPushConfigured ||
                  pushDeviceStatus !== "subscribed"
                }
              >
                {testingPush ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send test push
              </Button>
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Save notification toggles before testing contact alerts.
              </span>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Integrations */}
      <SettingsSection title="Integrations">
        <div className="space-y-3">
          <Field label="Instagram access token">
            <Input
              type="password"
              value={igAccessToken}
              onChange={(e) => setIgAccessToken(e.target.value)}
              autoComplete="off"
              placeholder={
                s.igAccessTokenSet
                  ? "•••••••• (connected — leave blank to keep)"
                  : "Paste an Instagram Graph API token"
              }
            />
          </Field>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Powers the <strong>Instagram feed</strong> page block. Create a long-lived
            token in the{" "}
            <a
              href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              Meta / Instagram developer console
            </a>
            . Until connected, the Instagram block shows your most recent library photos
            instead. The token is stored encrypted.
          </p>
        </div>
      </SettingsSection>

      <div className="sticky bottom-0 flex justify-end border-t bg-[hsl(var(--background))] py-3">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
