import { getEmailQueue } from "@/src/queue/queues";
import type { EmailMessage } from "@/src/email/provider";

// Outbound email is enqueued (BullMQ) and sent by the worker, so API requests
// never block on SMTP/Resend. Best-effort: never throws into the caller.
export async function enqueueEmail(message: EmailMessage): Promise<void> {
  try {
    await getEmailQueue().add("send", { message });
  } catch (err) {
    console.error("[email] failed to enqueue", err);
  }
}
