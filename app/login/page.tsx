"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Loader2 } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { signIn, twoFactor, useSession } from "@/src/auth/client";
import { SITE } from "@/src/lib/seo";

type Step = "credentials" | "totp";

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Best-effort extraction of a human-readable message from a Better Auth error
// object (shape: { message?: string } | null).
function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Bot protection (Cloudflare Turnstile). Config comes from /auth-config so the
  // same image works with different keys per environment.
  const [captcha, setCaptcha] = useState<{ enabled: boolean; siteKey: string | null }>({
    enabled: false,
    siteKey: null,
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Already authenticated — bounce into the admin shell.
  useEffect(() => {
    if (session.data) router.replace("/admin");
  }, [session.data, router]);

  // Fetch whether the login captcha is on + its site key.
  useEffect(() => {
    fetch("/api/v1/auth-config")
      .then((r) => r.json())
      .then((d) => setCaptcha(d.captcha ?? { enabled: false, siteKey: null }))
      .catch(() => {});
  }, []);

  // Load the Turnstile script + render the widget when enabled.
  useEffect(() => {
    if (!captcha.enabled || !captcha.siteKey || step !== "credentials") return;
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !widgetRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // already rendered
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: captcha.siteKey!,
        callback: (t) => setCaptchaToken(t),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
      });
    };
    if (window.turnstile) {
      renderWidget();
    } else if (!document.querySelector(`script[src="${TURNSTILE_SRC}"]`)) {
      const s = document.createElement("script");
      s.src = TURNSTILE_SRC;
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      const t = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(t);
          renderWidget();
        }
      }, 200);
      return () => window.clearInterval(t);
    }
    return () => {
      cancelled = true;
    };
  }, [captcha.enabled, captcha.siteKey, step]);

  function resetCaptcha() {
    setCaptchaToken(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }

  // Biometric second factor. When we reach the 2FA step, ask the server whether
  // this pending user has biometric required + a passkey; if so, offer it first
  // with TOTP as the fallback.
  const [bioOptions, setBioOptions] = useState<unknown | null>(null);
  const [bioChecked, setBioChecked] = useState(false);
  const [useCode, setUseCode] = useState(false);

  useEffect(() => {
    if (step !== "totp") return;
    setBioChecked(false);
    fetch("/api/auth/two-factor/passkey/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => {
        if (d?.available && d.options) {
          setBioOptions(d.options);
        } else {
          setUseCode(true); // no biometric → straight to the code form
        }
      })
      .catch(() => setUseCode(true))
      .finally(() => setBioChecked(true));
  }, [step]);

  async function onBiometric() {
    if (!bioOptions) return;
    setError(null);
    setPending(true);
    try {
      const assertion = await startAuthentication({
        optionsJSON: bioOptions as Parameters<
          typeof startAuthentication
        >[0]["optionsJSON"],
      });
      const res = await fetch("/api/auth/two-factor/passkey/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(errorMessage(data) ?? "Biometric verification failed.");
        return;
      }
      await finishLogin();
    } catch {
      // User cancelled / no biometric — let them use the code instead.
      setError("Couldn't verify with biometric. Use your authenticator code.");
      setUseCode(true);
    } finally {
      setPending(false);
    }
  }

  async function finishLogin() {
    router.push("/admin");
    router.refresh();
  }

  async function onCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (captcha.enabled && !captchaToken) {
      setError("Please complete the human verification.");
      return;
    }
    setPending(true);
    try {
      const res = await signIn.email(
        { email, password },
        captcha.enabled && captchaToken
          ? { headers: { "x-captcha-response": captchaToken } }
          : undefined,
      );
      if (res.error) {
        setError(errorMessage(res.error));
        resetCaptcha();
        return;
      }
      if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setStep("totp");
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(errorMessage(err));
      resetCaptcha();
    } finally {
      setPending(false);
    }
  }

  async function onTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await twoFactor.verifyTotp({ code });
      if (res.error) {
        setError(errorMessage(res.error));
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function onPasskey() {
    setError(null);
    setPending(true);
    try {
      const res = await signIn.passkey();
      if (res?.error) {
        setError(errorMessage(res.error));
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setCode("");
    setError(null);
    setBioOptions(null);
    setUseCode(false);
    setBioChecked(false);
  }

  return (
    <main className="mx-auto mt-24 w-full max-w-sm px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-lg">{SITE.name}</CardTitle>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            {step === "credentials"
              ? "Sign in to the studio admin"
              : "Enter your authentication code"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
            >
              {error}
            </p>
          )}

          {step === "credentials" ? (
            <form onSubmit={onCredentialsSubmit} className="space-y-4">
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
              </Field>
              {captcha.enabled && (
                <div ref={widgetRef} className="flex justify-center" />
              )}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          ) : bioOptions && !useCode ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-[hsl(var(--muted-foreground))]">
                Confirm it’s you with your biometric.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={pending}
                onClick={onBiometric}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4" />
                )}
                Verify with biometric
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending}
                onClick={() => {
                  setUseCode(true);
                  setError(null);
                }}
              >
                Use authenticator code instead
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending}
                onClick={backToCredentials}
              >
                Back
              </Button>
            </div>
          ) : !bioChecked && !useCode ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--muted-foreground))]" />
            </div>
          ) : (
            <form onSubmit={onTotpSubmit} className="space-y-4">
              <Field
                label="Authentication code"
                htmlFor="code"
                hint="Enter the 6-digit code from your authenticator app."
              >
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={pending}
                />
              </Field>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending}
                onClick={backToCredentials}
              >
                Back
              </Button>
            </form>
          )}

          {step === "credentials" && (
            <>
              <div className="flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                <span className="h-px flex-1 bg-[hsl(var(--border))]" />
                or
                <span className="h-px flex-1 bg-[hsl(var(--border))]" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={onPasskey}
              >
                <KeyRound className="h-4 w-4" />
                Sign in with passkey
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
