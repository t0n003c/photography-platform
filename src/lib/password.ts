import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// scrypt password hashing for GALLERY/GRANT passwords (SECURITY.md §6/§7.2).
// Admin/user passwords are handled by Better Auth — this is only for the
// optional client-gallery password layer.
const scryptAsync = promisify(scrypt);

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = (await scryptAsync(pw, salt, 64)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export async function verifyPassword(
  pw: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const dk = (await scryptAsync(pw, Buffer.from(saltHex, "hex"), 64)) as Buffer;
  const want = Buffer.from(hashHex, "hex");
  return dk.length === want.length && timingSafeEqual(dk, want);
}
