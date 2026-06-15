import { headers } from "next/headers";
import type { NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { forbidden, unauthorized } from "@/src/lib/http";

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

/** True if the session was strongly re-authenticated within `maxAgeSec` (step-up). */
export function isFresh(
  session: NonNullable<SessionResult>,
  maxAgeSec = 900,
): boolean {
  const created = new Date(session.session.createdAt).getTime();
  return Date.now() - created <= maxAgeSec * 1000;
}
