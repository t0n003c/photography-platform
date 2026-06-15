import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { forbidden, problem, unauthorized } from "@/src/lib/http";

// Server-side session + role helpers for admin Route Handlers (API-DESIGN §2.3).

export type Role = "owner" | "admin" | "staff";
const RANK: Record<Role, number> = { staff: 1, admin: 2, owner: 3 };

export type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

export async function getSession(): Promise<SessionResult> {
  return auth.api.getSession({ headers: await headers() });
}

function roleOf(session: NonNullable<SessionResult>): Role {
  const raw = (session.user.role ?? "staff").split(",")[0]!.trim();
  return (raw in RANK ? raw : "staff") as Role;
}

type Guard =
  | { error: NextResponse; session?: undefined }
  | { error?: undefined; session: NonNullable<SessionResult>; role: Role };

export async function requireUser(): Promise<Guard> {
  const session = await getSession();
  if (!session) return { error: unauthorized() };
  return { session, role: roleOf(session) };
}

export async function requireRole(min: Role): Promise<Guard> {
  const res = await requireUser();
  if (res.error) return res;
  if (RANK[res.role] < RANK[min]) return { error: forbidden() };
  return res;
}

/** True if the session was authenticated within `maxAgeSec` (step-up freshness). */
export function isFresh(
  session: NonNullable<SessionResult>,
  maxAgeSec = 900,
): boolean {
  const created = new Date(session.session.createdAt).getTime();
  return Date.now() - created <= maxAgeSec * 1000;
}

/**
 * Like requireRole, but ALSO requires a recent (fresh) authentication for
 * sensitive/destructive admin actions (SECURITY.md §2.4). When stale, returns
 * 403 STEP_UP_REQUIRED — the admin UI prompts a re-auth (password or passkey),
 * which creates a fresh session, then retries.
 */
export async function requireFreshAuth(
  min: Role,
  maxAgeSec = 900,
): Promise<Guard> {
  const res = await requireRole(min);
  if (res.error) return res;
  if (!isFresh(res.session, maxAgeSec)) {
    return {
      error: problem(
        403,
        "STEP_UP_REQUIRED",
        "Please re-authenticate to perform this action.",
      ),
    };
  }
  return res;
}
