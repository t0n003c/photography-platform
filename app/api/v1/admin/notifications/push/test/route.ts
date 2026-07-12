import { z } from "zod";
import { requireRole } from "@/src/auth/session";
import { ok, parseJson, problem } from "@/src/lib/http";
import { clientIp, userAgent } from "@/src/lib/request";
import { writeAudit } from "@/src/lib/audit";
import { sendWebPushToUser, webPushStatus } from "@/src/lib/web-push";

export const dynamic = "force-dynamic";

const TestSchema = z.object({
  endpoint: z.string().url().max(4096).optional(),
});

export async function POST(req: Request) {
  const a = await requireRole("admin");
  if (a.error) return a.error;

  const status = webPushStatus();
  if (!status.configured) {
    return problem(
      400,
      "WEB_PUSH_NOT_CONFIGURED",
      "Web Push is not configured. Set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY.",
    );
  }

  const parsed = await parseJson(req, TestSchema);
  if ("error" in parsed) return parsed.error;

  const result = await sendWebPushToUser(
    a.session.user.id,
    {
      title: "Test notification",
      body: "PWA notifications are working.",
      tag: "settings-test",
      url: "/admin/settings",
      icon: "/icon.svg",
      badge: "/icon.svg",
    },
    { endpoint: parsed.data.endpoint },
  );

  await writeAudit({
    actorId: a.session.user.id,
    action: "push_notification.test",
    entityType: "push_subscription",
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: result,
  });

  if (result.attempted === 0) {
    return problem(
      404,
      "PUSH_SUBSCRIPTION_NOT_FOUND",
      "No active push subscription found.",
    );
  }

  return ok(result);
}
