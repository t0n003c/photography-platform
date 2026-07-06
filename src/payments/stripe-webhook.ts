import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  opts: { nowMs?: number; toleranceSeconds?: number } = {},
) {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  const timestamp = Number(timestampPart?.slice(2));
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;

  const nowMs = opts.nowMs ?? Date.now();
  const toleranceSeconds = opts.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowMs / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return signatures.some((signature) => safeEqualHex(signature, expected));
}

export interface StripeCheckoutSessionEvent {
  id: string;
  type: string;
  api_version?: string | null;
  livemode?: boolean;
  data: {
    object: {
      id?: string;
      payment_status?: string;
      payment_intent?: string | null;
      amount_total?: number | null;
      metadata?: Record<string, string | undefined> | null;
    };
  };
}

export interface StripeRefundEvent {
  id: string;
  type: string;
  api_version?: string | null;
  livemode?: boolean;
  data: {
    object: {
      id?: string;
      amount?: number | null;
      currency?: string | null;
      status?: string | null;
      payment_intent?: string | null;
      failure_reason?: string | null;
      created?: number | null;
      metadata?: Record<string, string | undefined> | null;
    };
  };
}

export type StripeWebhookEvent = StripeCheckoutSessionEvent | StripeRefundEvent;
