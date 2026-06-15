"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { signIn, twoFactor, useSession } from "@/src/auth/client";
import { SITE } from "@/src/lib/seo";

type Step = "credentials" | "totp";

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

  // Already authenticated — bounce into the admin shell.
  useEffect(() => {
    if (session.data) router.replace("/admin");
  }, [session.data, router]);

  async function finishLogin() {
    router.push("/admin");
    router.refresh();
  }

  async function onCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await signIn.email({ email, password });
      if (res.error) {
        setError(errorMessage(res.error));
        return;
      }
      if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setStep("totp");
        return;
      }
      await finishLogin();
    } catch (err) {
      setError(errorMessage(err));
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
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
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
                onClick={() => {
                  setStep("credentials");
                  setCode("");
                  setError(null);
                }}
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
