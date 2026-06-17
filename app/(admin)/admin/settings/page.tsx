"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload as UploadIcon, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/src/lib/api-client";

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
}

function errMsg(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

const LOCALES = [
  "en", "en-US", "en-GB", "fr", "fr-FR", "de", "es", "es-ES", "it", "pt",
  "pt-BR", "nl", "ja", "ko", "zh", "zh-CN", "vi", "ru",
];

function useTimezones(): string[] {
  return useMemo(() => {
    try {
      // Supported in modern browsers; fall back to a short common list.
      const fn = (Intl as unknown as {
        supportedValuesOf?: (k: string) => string[];
      }).supportedValuesOf;
      if (fn) return fn("timeZone");
    } catch {
      /* ignore */
    }
    return [
      "UTC", "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
      "Asia/Tokyo", "Asia/Shanghai", "Asia/Ho_Chi_Minh", "Australia/Sydney",
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
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [testing, setTesting] = useState(false);
  const [iconBust, setIconBust] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const timezones = useTimezones();

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

  const update = <K extends keyof SettingsDTO>(key: K, value: SettingsDTO[K]) =>
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));

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
      };
      // Secrets: only send when the admin typed a new value (write-only).
      if (smtpPassword) payload.smtpPassword = smtpPassword;
      if (resendApiKey) payload.resendApiKey = resendApiKey;

      await api.patch("/api/v1/admin/settings", payload);
      setSmtpPassword("");
      setResendApiKey("");
      setS((prev) =>
        prev
          ? {
              ...prev,
              smtpPasswordSet: prev.smtpPasswordSet || Boolean(smtpPassword),
              resendApiKeySet: prev.resendApiKeySet || Boolean(resendApiKey),
            }
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
      const res = await api.post<{ data: { to: string } }>(
        "/api/v1/admin/settings/test-email",
        {},
      );
      toast(`Test email sent to ${res.data.to}`, "success");
    } catch (err) {
      toast(errMsg(err), "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading || !s) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Site-wide configuration: branding, locale, and email.
        </p>
      </div>

      {/* General */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-[hsl(var(--muted))]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/v1/media/site-icon?v=${iconBust}`}
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
                PNG, JPEG, WebP, SVG or ICO · up to 1 MB. Used as favicon and app
                icon.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle>Email (SMTP)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex justify-end border-t bg-[hsl(var(--background))] py-3">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
