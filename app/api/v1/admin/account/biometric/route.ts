import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireUser } from "@/src/auth/session";
import { ok, problem, parseJson } from "@/src/lib/http";
import { db } from "@/src/db/client";
import { user as userTable, passkey as passkeyTable } from "@/src/db/schema";

export const dynamic = "force-dynamic";

const Body = z.object({ enabled: z.boolean() });

// Turn the biometric second factor on/off for the signed-in user. Enabling
// requires a registered passkey AND two-factor (TOTP) — TOTP is the fallback.
export async function POST(req: Request) {
  const a = await requireUser();
  if (a.error) return a.error;
  const parsed = await parseJson(req, Body);
  if ("error" in parsed) return parsed.error;
  const userId = a.session.user.id;

  if (parsed.data.enabled) {
    const pks = await db
      .select({ id: passkeyTable.id })
      .from(passkeyTable)
      .where(eq(passkeyTable.userId, userId))
      .limit(1);
    if (pks.length === 0) {
      return problem(400, "NO_PASSKEY", "Add a passkey before enabling biometric sign-in.");
    }
    const u = await db
      .select({ tfe: userTable.twoFactorEnabled })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!u[0]?.tfe) {
      return problem(
        400,
        "NO_TWO_FACTOR",
        "Enable two-factor (authenticator) first — it's the fallback if biometric fails.",
      );
    }
  }

  await db
    .update(userTable)
    .set({ requireBiometric: parsed.data.enabled })
    .where(eq(userTable.id, userId));

  return ok({ requireBiometric: parsed.data.enabled });
}
