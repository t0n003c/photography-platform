import { eq } from "drizzle-orm";
import { db } from "@/src/db/client";
import { stripeWebhookEvent } from "@/src/db/schema";

export type StripeWebhookEventStatus =
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

interface StripeWebhookEventInput {
  id: string;
  type: string;
  livemode?: boolean | null;
  apiVersion?: string | null;
  invoiceId?: string | null;
  sessionId?: string | null;
  paymentIntentId?: string | null;
}

export async function beginStripeWebhookEvent(input: StripeWebhookEventInput): Promise<
  | { action: "process"; status: "processing" }
  | { action: "skip"; status: StripeWebhookEventStatus }
> {
  const inserted = await db
    .insert(stripeWebhookEvent)
    .values({
      id: input.id,
      type: input.type,
      livemode: input.livemode ?? null,
      apiVersion: input.apiVersion ?? null,
      invoiceId: input.invoiceId ?? null,
      sessionId: input.sessionId ?? null,
      paymentIntentId: input.paymentIntentId ?? null,
    })
    .onConflictDoNothing({ target: stripeWebhookEvent.id })
    .returning({ id: stripeWebhookEvent.id });

  if (inserted.length > 0) return { action: "process", status: "processing" };

  const existing = await db
    .select({ status: stripeWebhookEvent.status })
    .from(stripeWebhookEvent)
    .where(eq(stripeWebhookEvent.id, input.id))
    .limit(1);
  const status = (existing[0]?.status ?? "processed") as StripeWebhookEventStatus;

  if (status !== "failed") {
    return { action: "skip", status };
  }

  await db
    .update(stripeWebhookEvent)
    .set({
      status: "processing",
      error: null,
      processedAt: null,
      invoiceId: input.invoiceId ?? null,
      sessionId: input.sessionId ?? null,
      paymentIntentId: input.paymentIntentId ?? null,
    })
    .where(eq(stripeWebhookEvent.id, input.id));
  return { action: "process", status: "processing" };
}

export async function finishStripeWebhookEvent(
  id: string,
  status: Exclude<StripeWebhookEventStatus, "processing">,
  input: {
    invoiceId?: string | null;
    sessionId?: string | null;
    paymentIntentId?: string | null;
    error?: string | null;
  } = {},
) {
  await db
    .update(stripeWebhookEvent)
    .set({
      status,
      invoiceId: input.invoiceId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      paymentIntentId: input.paymentIntentId ?? undefined,
      error: input.error ?? null,
      processedAt: new Date(),
    })
    .where(eq(stripeWebhookEvent.id, id));
}
