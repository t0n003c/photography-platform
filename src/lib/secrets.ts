import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { getEnv } from "@/src/lib/env";

// AES-256-GCM at-rest encryption for editable secrets stored in the DB (e.g. the
// SMTP password configured via the Settings UI). The key comes from
// SETTINGS_ENCRYPTION_KEY (64 hex chars / 32 bytes); when unset it is derived
// from BETTER_AUTH_SECRET so dev/local boots without extra config. The
// plaintext secret never lives in code — only in the operator's environment.
//
// Wire format (string): base64(iv).base64(authTag).base64(ciphertext)

let key: Buffer | null = null;

function getKey(): Buffer {
  if (key) return key;
  const env = getEnv();
  if (env.SETTINGS_ENCRYPTION_KEY) {
    const hex = env.SETTINGS_ENCRYPTION_KEY.trim();
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        "SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes).",
      );
    }
    key = Buffer.from(hex, "hex");
  } else {
    // Deterministic fallback so the feature works out of the box. Salt is fixed
    // (the key's secrecy comes from BETTER_AUTH_SECRET, not the salt).
    key = scryptSync(env.BETTER_AUTH_SECRET, "site-settings-secret", 32);
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    // Wrong key / tampered ciphertext — treat as unset rather than crash.
    return null;
  }
}
