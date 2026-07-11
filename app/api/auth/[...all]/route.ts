import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/src/auth";
import { type SecurityOutcome, writeSecurityEvent } from "@/src/lib/security-events";

// Mounts all Better Auth routes under /api/auth/* (sign-in, 2FA, passkey, …).
// These are owned by Better Auth and are not versioned (API-DESIGN §1).
const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

function isEmailSignIn(req: Request): boolean {
  try {
    return new URL(req.url).pathname.endsWith("/sign-in/email");
  } catch {
    return false;
  }
}

async function readLoginEmail(req: Request): Promise<string | null> {
  try {
    const body = (await req.clone().json()) as unknown;
    if (body && typeof body === "object" && "email" in body) {
      const email = (body as { email?: unknown }).email;
      return typeof email === "string" ? email : null;
    }
  } catch {
    return null;
  }
  return null;
}

function classifyLogin(status: number): {
  action: string;
  outcome: SecurityOutcome;
} {
  if (status === 429) return { action: "login.rate_limited", outcome: "blocked" };
  if (status === 403) return { action: "login.blocked", outcome: "blocked" };
  if (status >= 200 && status < 300) {
    return { action: "login.success", outcome: "success" };
  }
  if (status >= 400) return { action: "login.failed", outcome: "failed" };
  return { action: "login.attempt", outcome: "unknown" };
}

export async function POST(req: Request) {
  const logLogin = isEmailSignIn(req);
  const email = logLogin ? await readLoginEmail(req) : null;

  try {
    const res = await handlers.POST(req);
    if (logLogin) {
      const result = classifyLogin(res.status);
      await writeSecurityEvent({
        req,
        surface: "login",
        action: result.action,
        outcome: result.outcome,
        email,
        metadata: { status: res.status },
      });
    }
    return res;
  } catch (err) {
    if (logLogin) {
      await writeSecurityEvent({
        req,
        surface: "login",
        action: "login.failed",
        outcome: "failed",
        email,
        metadata: {
          error: err instanceof Error ? err.name : "unknown",
        },
      });
    }
    throw err;
  }
}
