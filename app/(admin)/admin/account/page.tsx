"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { KeyRound, Loader2, Monitor, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { api } from "@/src/lib/api-client";
import {
  authClient,
  passkey,
  twoFactor,
  useSession,
} from "@/src/auth/client";

// ---- shared helpers -------------------------------------------------------

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Something went wrong. Please try again.";
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

// Better Auth list endpoints sometimes return the array directly and sometimes
// wrap it in `{ data }`. Normalize to a plain array.
function asArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object" && "data" in res) {
    const d = (res as { data?: unknown }).data;
    if (Array.isArray(d)) return d as T[];
  }
  return [];
}

type PasskeyRow = { id: string; name?: string; createdAt?: string | Date };
type SessionRow = {
  id: string;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string | Date;
};

export default function AccountPage() {
  const { toast } = useToast();
  const session = useSession();
  const user = session.data?.user as
    | {
        name?: string;
        email?: string;
        role?: string;
        twoFactorEnabled?: boolean;
      }
    | undefined;

  // ---- passkeys ----------------------------------------------------------
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [addingPasskey, setAddingPasskey] = useState(false);

  const loadPasskeys = useCallback(async () => {
    setPasskeysLoading(true);
    try {
      const res = await authClient.passkey.listUserPasskeys();
      if ((res as { error?: unknown })?.error) {
        toast(errorMessage((res as { error?: unknown }).error), "error");
        setPasskeys([]);
      } else {
        setPasskeys(asArray<PasskeyRow>(res));
      }
    } catch (err) {
      toast(errorMessage(err), "error");
      setPasskeys([]);
    } finally {
      setPasskeysLoading(false);
    }
  }, [toast]);

  async function addPasskey() {
    setAddingPasskey(true);
    try {
      const res = await passkey.addPasskey({ name: "Admin device" });
      if (res?.error) {
        toast(errorMessage(res.error), "error");
        return;
      }
      toast("Passkey added.", "success");
      await loadPasskeys();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setAddingPasskey(false);
    }
  }

  async function removePasskey(id: string) {
    try {
      const res = await authClient.passkey.deletePasskey({ id });
      if ((res as { error?: unknown })?.error) {
        toast(errorMessage((res as { error?: unknown }).error), "error");
        return;
      }
      toast("Passkey removed.", "success");
      await loadPasskeys();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  // ---- sessions ----------------------------------------------------------
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await authClient.listSessions();
      if ((res as { error?: unknown })?.error) {
        toast(errorMessage((res as { error?: unknown }).error), "error");
        setSessions([]);
      } else {
        setSessions(asArray<SessionRow>(res));
      }
    } catch (err) {
      toast(errorMessage(err), "error");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, [toast]);

  async function revokeSession(token: string) {
    try {
      const res = await authClient.revokeSession({ token });
      if ((res as { error?: unknown })?.error) {
        toast(errorMessage((res as { error?: unknown }).error), "error");
        return;
      }
      toast("Session revoked.", "success");
      await loadSessions();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function revokeOthers() {
    try {
      const res = await authClient.revokeOtherSessions();
      if ((res as { error?: unknown })?.error) {
        toast(errorMessage((res as { error?: unknown }).error), "error");
        return;
      }
      toast("Signed out other sessions.", "success");
      await loadSessions();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    void loadPasskeys();
    void loadSessions();
  }, [loadPasskeys, loadSessions]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.isPending ? (
            <Spinner />
          ) : user ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[hsl(var(--muted-foreground))]">Name</dt>
                <dd className="font-medium">{user.name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[hsl(var(--muted-foreground))]">Email</dt>
                <dd className="font-medium">{user.email || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[hsl(var(--muted-foreground))]">Role</dt>
                <dd>
                  <Badge tone="blue">{user.role || "staff"}</Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[hsl(var(--muted-foreground))]">
                  Two-factor
                </dt>
                <dd>
                  {user.twoFactorEnabled ? (
                    <Badge tone="green">Enabled</Badge>
                  ) : (
                    <Badge tone="neutral">Off</Badge>
                  )}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Not signed in.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Two-factor */}
      <TwoFactorCard
        enabled={!!user?.twoFactorEnabled}
        onChanged={() => session.refetch?.()}
      />

      {/* Bot protection */}
      <BotProtectionCard />

      {/* Passkeys */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Passkeys</CardTitle>
          <Button size="sm" onClick={addPasskey} disabled={addingPasskey}>
            {addingPasskey ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Add passkey
          </Button>
        </CardHeader>
        <CardContent>
          {passkeysLoading ? (
            <Spinner />
          ) : passkeys.length === 0 ? (
            <EmptyState
              title="No passkeys yet"
              description="Add a passkey to sign in without a password."
            />
          ) : (
            <ul className="divide-y">
              {passkeys.map((pk) => (
                <li
                  key={pk.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {pk.name || "Passkey"}
                    </p>
                    {pk.createdAt && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        Added {formatDate(pk.createdAt)}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => removePasskey(pk.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Active sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active sessions</CardTitle>
          <Button size="sm" variant="outline" onClick={revokeOthers}>
            Sign out other sessions
          </Button>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <Spinner />
          ) : sessions.length === 0 ? (
            <EmptyState title="No active sessions" />
          ) : (
            <ul className="divide-y">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.userAgent || "Unknown device"}
                      </p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">
                        {s.ipAddress || "Unknown IP"}
                        {s.createdAt ? ` · ${formatDate(s.createdAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revokeSession(s.token)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Two-factor card ------------------------------------------------------

type TfStage = "idle" | "password" | "confirm";

function TwoFactorCard({
  enabled,
  onChanged,
}: {
  enabled: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<TfStage>("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [totpURI, setTotpURI] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  function reset() {
    setStage("idle");
    setPassword("");
    setCode("");
    setTotpURI("");
    setQrDataUrl("");
    setBackupCodes([]);
    setPending(false);
  }

  // Render the TOTP URI as a scannable QR code whenever it changes.
  useEffect(() => {
    if (!totpURI) {
      setQrDataUrl("");
      return;
    }
    let active = true;
    QRCode.toDataURL(totpURI)
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [totpURI]);

  function openModal() {
    reset();
    setStage("password");
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    reset();
  }

  async function submitEnable(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await twoFactor.enable({ password });
      if (res.error) {
        toast(errorMessage(res.error), "error");
        return;
      }
      const data = res.data as
        | { totpURI?: string; backupCodes?: string[] }
        | null;
      setTotpURI(data?.totpURI ?? "");
      setBackupCodes(Array.isArray(data?.backupCodes) ? data!.backupCodes : []);
      setStage("confirm");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPending(false);
    }
  }

  async function submitConfirm(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await twoFactor.verifyTotp({ code });
      if (res.error) {
        toast(errorMessage(res.error), "error");
        return;
      }
      toast("Two-factor authentication enabled.", "success");
      closeModal();
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPending(false);
    }
  }

  async function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await twoFactor.disable({ password });
      if (res.error) {
        toast(errorMessage(res.error), "error");
        return;
      }
      toast("Two-factor authentication disabled.", "success");
      closeModal();
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Two-factor authentication</CardTitle>
        {enabled ? (
          <Button size="sm" variant="destructive" onClick={openModal}>
            Disable
          </Button>
        ) : (
          <Button size="sm" onClick={openModal}>
            <ShieldCheck className="h-4 w-4" />
            Enable
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          {enabled
            ? "Two-factor authentication is currently protecting your account."
            : "Add an extra layer of security with a time-based one-time code."}
        </p>
      </CardContent>

      <Modal
        open={open}
        onClose={closeModal}
        title={enabled ? "Disable two-factor" : "Enable two-factor"}
      >
        {enabled ? (
          <form onSubmit={submitDisable} className="space-y-4">
            <Field
              label="Confirm your password"
              htmlFor="tf-disable-password"
            >
              <Input
                id="tf-disable-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Disable
              </Button>
            </div>
          </form>
        ) : stage === "confirm" ? (
          <form onSubmit={submitConfirm} className="space-y-4">
            {qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Scan with your authenticator app"
                  width={180}
                  height={180}
                  className="rounded-md border bg-white p-2"
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Scan with your authenticator app.
                </p>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-sm font-medium">Setup key (TOTP URI)</p>
              <div className="select-all break-all rounded-md border bg-[hsl(var(--muted))] p-3 font-mono text-xs">
                {totpURI || "—"}
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Add this to your authenticator app.
              </p>
            </div>

            {backupCodes.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Backup codes</p>
                <ul className="grid grid-cols-2 gap-1 rounded-md border p-3 font-mono text-xs">
                  {backupCodes.map((bc) => (
                    <li key={bc} className="select-all">
                      {bc}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Store these somewhere safe — each can be used once.
                </p>
              </div>
            )}

            <Field
              label="Enter code to confirm"
              htmlFor="tf-confirm-code"
              hint="Enter the 6-digit code from your authenticator app."
            >
              <Input
                id="tf-confirm-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                disabled={pending}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitEnable} className="space-y-4">
            <Field label="Confirm your password" htmlFor="tf-enable-password">
              <Input
                id="tf-enable-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </Card>
  );
}

// ---- Bot protection (Cloudflare Turnstile at login) -----------------------

function BotProtectionCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ data: { captchaEnabled: boolean; captchaConfigured: boolean } }>(
        "/api/v1/admin/settings",
      )
      .then((res) => {
        setEnabled(res.data.captchaEnabled);
        setConfigured(res.data.captchaConfigured);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    try {
      await api.patch("/api/v1/admin/settings", { captchaEnabled: next });
      setEnabled(next);
      toast(
        next ? "Bot protection enabled." : "Bot protection disabled.",
        "success",
      );
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Bot protection</CardTitle>
        <Button
          size="sm"
          variant={enabled ? "default" : "outline"}
          onClick={toggle}
          disabled={loading || saving || !configured}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {enabled ? "On" : "Off"}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Require a “verify you’re human” check (Cloudflare Turnstile) on the
          sign-in form to block automated login attempts.
        </p>
        {!loading && !configured && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Turnstile keys aren’t set for this server yet. Add{" "}
            <code>TURNSTILE_SITE_KEY</code> and{" "}
            <code>TURNSTILE_SECRET_KEY</code> to the environment, then this can
            be turned on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
