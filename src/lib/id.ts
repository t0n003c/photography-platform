import { randomBytes } from "node:crypto";

// ULID-style identifiers: 48-bit timestamp + 80-bit randomness, Crockford
// base32, 26 chars. Lexicographically sortable (good for keyset pagination and
// opaque-but-ordered PKs per DATA-MODEL §2). Better Auth generates its own ids
// for its tables; this is for application tables only.
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newId(): string {
  let now = Date.now();
  const time = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    time[i] = ENCODING[now % 32];
    now = Math.floor(now / 32);
  }
  const rand = randomBytes(16);
  let r = "";
  for (let i = 0; i < 16; i++) r += ENCODING[rand[i] % 32];
  return time.join("") + r;
}
