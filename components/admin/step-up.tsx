"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/dialog";
import { ApiError } from "@/src/lib/api-client";
import { authClient, signIn, useSession } from "@/src/auth/client";

// ---------------------------------------------------------------------------
// Step-up re-authentication.
//
// Some destructive admin API calls return an ApiError with
// code === "STEP_UP_REQUIRED". `runWithStepUp(action)` runs the action; if it
// fails with that code it prompts for re-authentication (password or passkey)
// and, on success, retries the action exactly once.
// ---------------------------------------------------------------------------

const STEP_UP_CODE = "STEP_UP_REQUIRED";

function isStepUpError(err: unknown): boolean {
  return err instanceof ApiError && err.code === STEP_UP_CODE;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Re-authentication failed. Please try again.";
}

type StepUpCtx = {
  runWithStepUp: <T>(action: () => Promise<T>) => Promise<T>;
};

const Ctx = createContext<StepUpCtx | null>(null);

export function useStepUp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStepUp must be used within <StepUpProvider>");
  return ctx;
}

// Internal: a pending re-auth request awaiting the user's resolution.
type Pending = {
  resolve: () => void;
  reject: (reason: unknown) => void;
};

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const email = session.data?.user?.email ?? "";

  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef<Pending | null>(null);

  // Open the modal and resolve once the user successfully re-authenticates.
  const requestStepUp = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setPassword("");
      setError("");
      setPending(false);
      setOpen(true);
    });
  }, []);

  const finish = useCallback((err?: unknown) => {
    const p = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    setPending(false);
    setPassword("");
    setError("");
    if (!p) return;
    if (err) p.reject(err);
    else p.resolve();
  }, []);

  const cancel = useCallback(() => {
    finish(new Error("Re-authentication cancelled"));
  }, [finish]);

  const runWithStepUp = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T> => {
      try {
        return await action();
      } catch (err) {
        if (!isStepUpError(err)) throw err;
        // Prompt for re-auth; rethrows if the user cancels.
        await requestStepUp();
        // Retry exactly once.
        return await action();
      }
    },
    [requestStepUp],
  );

  const submitPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email) {
        setError("No active session email available.");
        return;
      }
      setPending(true);
      setError("");
      try {
        const res = await signIn.email({ email, password });
        if ((res as { error?: unknown })?.error) {
          setError(errorMessage((res as { error?: unknown }).error));
          setPending(false);
          return;
        }
        finish();
      } catch (err) {
        setError(errorMessage(err));
        setPending(false);
      }
    },
    [email, password, finish],
  );

  const submitPasskey = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const res = await authClient.signIn.passkey();
      if ((res as { error?: unknown } | undefined)?.error) {
        setError(errorMessage((res as { error?: unknown }).error));
        setPending(false);
        return;
      }
      finish();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }, [finish]);

  return (
    <Ctx.Provider value={{ runWithStepUp }}>
      {children}
      <Modal open={open} onClose={cancel} title="Confirm it's you">
        <form onSubmit={submitPassword} className="space-y-4">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            This action requires re-authentication. Confirm your password or use
            a passkey to continue.
          </p>
          <Field label="Password" htmlFor="step-up-password">
            <Input
              id="step-up-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
              autoFocus
            />
          </Field>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={cancel}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={submitPasskey}
              disabled={pending}
            >
              Use passkey
            </Button>
            <Button type="submit" disabled={pending || !password}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </form>
      </Modal>
    </Ctx.Provider>
  );
}
