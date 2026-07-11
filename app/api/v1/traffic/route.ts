import { z } from "zod";
import { accepted, parseJson } from "@/src/lib/http";
import { rateLimit } from "@/src/lib/ratelimit";
import { clientIp } from "@/src/lib/request";
import { writeSecurityEvent } from "@/src/lib/security-events";
import { normalizePathForSecurityEvent } from "@/src/lib/security-event-utils";

export const dynamic = "force-dynamic";

const trafficSchema = z.object({
  path: z.string().trim().max(2048).optional(),
  referrer: z.string().trim().max(4096).optional(),
});

function shouldIgnorePath(path: string | null): boolean {
  if (!path) return true;
  return path.startsWith("/admin") || path.startsWith("/api");
}

// POST /api/v1/traffic - progressive public traffic-source beacon.
export async function POST(req: Request) {
  const parsed = await parseJson(req, trafficSchema);
  if ("error" in parsed) return accepted({ recorded: false });

  const path = normalizePathForSecurityEvent(parsed.data.path);
  if (shouldIgnorePath(path)) return accepted({ recorded: false });

  const ip = clientIp(req);
  const limited = await rateLimit(`traffic:h:${ip}`, 120, 3600);
  if (!limited.ok) return accepted({ recorded: false });

  await writeSecurityEvent({
    req,
    surface: "traffic",
    action: "traffic.page_view",
    outcome: "allowed",
    path,
    referrer: parsed.data.referrer ?? null,
  });

  return accepted({ recorded: true });
}
