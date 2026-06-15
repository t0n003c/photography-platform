"use client";

import * as React from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/feedback";

interface UnlockFormProps {
  token: string;
  onUnlocked: () => void;
}

export function UnlockForm({ token, onUnlocked }: UnlockFormProps) {
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/g/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        onUnlocked();
        return;
      }
      let code: string | undefined;
      try {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string };
        };
        code = body.error?.code;
      } catch {
        // ignore body parse failure
      }
      setError(
        code === "INVALID_PASSWORD"
          ? "Incorrect password."
          : "Something went wrong. Please try again.",
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border bg-[hsl(var(--card))] p-8 shadow-sm"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
            <Lock
              className="h-5 w-5 text-[hsl(var(--muted-foreground))]"
              aria-hidden="true"
            />
          </div>
          <h1 className="text-lg font-semibold">This gallery is private</h1>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
            Enter the password to view these photos.
          </p>
        </div>

        <Field label="Password" htmlFor="gallery-password">
          <Input
            id="gallery-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gallery-password-error" : undefined}
          />
        </Field>

        {error && (
          <p
            id="gallery-password-error"
            role="alert"
            className="mt-2 text-sm text-red-600"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={submitting || password.length === 0}
        >
          {submitting && <Spinner className="text-current" />}
          {submitting ? "Unlocking…" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}
