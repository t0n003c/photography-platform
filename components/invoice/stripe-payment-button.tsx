"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

async function readError(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message || "Could not start online payment.";
  } catch {
    return "Could not start online payment.";
  }
}

export function StripePaymentButton({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/invoices/${encodeURIComponent(token)}/checkout`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error(await readError(res));
      const body = (await res.json()) as { data?: { checkoutUrl?: string } };
      if (!body.data?.checkoutUrl) {
        throw new Error("Stripe did not return a checkout link.");
      }
      window.location.assign(body.data.checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start online payment.");
      setPending(false);
    }
  }

  return (
    <div className="print:hidden">
      <Button type="button" onClick={startCheckout} disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <CreditCard className="h-4 w-4" aria-hidden />
        )}
        {pending ? "Opening checkout..." : "Pay online"}
      </Button>
      {error && (
        <p className="mt-2 max-w-xs text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
