import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/src/lib/env";

const PREFIX = "ord";

function sign(payload: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function issueOrderStatusToken(orderId: string): string {
  const payload = `${PREFIX}.${orderId}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyOrderStatusToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [prefix, orderId, sig] = parts;
  if (prefix !== PREFIX || !orderId || !sig) return null;

  const expected = sign(`${prefix}.${orderId}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return orderId;
}
