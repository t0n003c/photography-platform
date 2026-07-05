import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/src/lib/env";

const PREFIX = "inv";

function sign(payload: string): string {
  return createHmac("sha256", getEnv().BETTER_AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

export function issueInvoiceToken(invoiceId: string): string {
  const payload = `${PREFIX}.${invoiceId}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyInvoiceToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [prefix, invoiceId, sig] = parts;
  if (prefix !== PREFIX || !invoiceId || !sig) return null;

  const expected = sign(`${prefix}.${invoiceId}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return invoiceId;
}
